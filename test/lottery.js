contract('Lottery', function(accounts) {
  console.log(accounts);
  var acc1 = accounts[0];
  var acc2 = accounts[1];
  var acc3 = accounts[2];
  var gasPrice = 100000000000; // default
  var hash = '0xd4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35';
  var hash2 = '0xec4916dd28fc4c10d78e287ca5d9cc51ee1ae73cbfde08c6b37324cbfaac8bc5'; // hash for commitment number 1
  var hash3 = '0x9267d3dbed802941483f1afa2a6bc68de5f653128aca9bf1461c5d0a3ad36ed2'; // hash for commitment number 2

  it("Successfully buy a ticket", function(done) {

    Lottery.new({ from: acc1 }).then(function(lot) {

      var bet = web3.toBigNumber(web3.toWei(0.05, 'ether'));
      var accBal = web3.toBigNumber(web3.eth.getBalance(acc2));
      var initialContractBal = web3.eth.getBalance(lot.address).toNumber();  

      lot.buyTicket(3, hash, { from: acc2, value: bet }).then(function() {
        var newContractBal = web3.eth.getBalance(lot.address).toNumber();
        var contractDiff = newContractBal - initialContractBal;

        assert.equal(contractDiff, bet, "Difference in contract balance == bet");
        return lot.jackpot.call(); 
      }).then(function(pot) { 
        var endAccBal = web3.toBigNumber(web3.eth.getBalance(acc2));
        var diff = accBal.minus(endAccBal).abs();

        assert.equal(pot, bet.toNumber(), "Jackpot == bet");
        return lot.lotteryStart.call()
      }).then(function(start) {
        assert.notEqual(start, 0, "lotteryStart > 0");
        done();
      }).catch(done);
    }).catch(done);
  });

  it("Throw error if ticket number is out of bounds", function(done) {

    Lottery.new({ from: acc1 }).then(function(lot) {

      var bet = web3.toBigNumber(web3.toWei(0.05, 'ether'));

      lot.buyTicket(10, hash, { from: acc2, value: bet })
      .catch(function(err) {
        assert.notEqual(err, null, "Error should exist");
        done();
      })
    });
  });

  it("Reject with same hash", function(done) {

    Lottery.new({ from: acc1 }).then(function(lot) {

      var bet = web3.toWei(0.05, 'ether');
      var bet2 = web3.toWei(0.07, 'ether');
      var sumOfBets = Number(bet) + Number(bet2);
      var firstStart = 0;
      var initialContractBal = web3.eth.getBalance(lot.address).toNumber(); 

      lot.buyTicket(3, hash, { from: acc2, value: bet }).then(function() {
        lot.lotteryStart.call().then(function(start) {
          firstStart = start;
          return lot.buyTicket(1, hash, { from: acc3, value: bet2 })
        }).catch(function(err) {
          assert.notEqual(err, null, "Error should exist");
          done();
        });
      });
    });
  });

  it("Successfully buy 2 tickets", function(done) {

    Lottery.new({ from: acc1 }).then(function(lot) {

      var bet = web3.toWei(0.05, 'ether');
      var bet2 = web3.toWei(0.07, 'ether');
      var sumOfBets = Number(bet) + Number(bet2);
      var firstStart = 0;
      var initialContractBal = web3.eth.getBalance(lot.address).toNumber(); 

      lot.buyTicket(3, hash, { from: acc2, value: bet }).then(function() {
        lot.lotteryStart.call().then(function(start) {
          firstStart = start;
          return lot.buyTicket(1, hash2, { from: acc3, value: bet2 })
        }).then(function() {
          var newContractBal = web3.eth.getBalance(lot.address).toNumber();
          var contractDiff = newContractBal - initialContractBal;

          assert.equal(contractDiff, sumOfBets, "Difference in contract balance = sum of bets");
          return lot.jackpot.call(); 
        }).then(function(pot) { 
          assert.equal(Number(pot), sumOfBets, "Jackpot = sum of bets");
          return lot.lotteryStart.call();
        }).then(function(start) { 
          assert.deepEqual(start, firstStart, "lotteryStart time should remain consistent");
          done();
        }).catch(done);
      }).catch(done);
    }).catch(done);
  });

  it("Check owner", function(done) {

    Lottery.new({ from: acc1 }).then(function(lot) {
      lot.banker.call().then(function(owner) {
        assert.equal(owner, acc1, "Owner is the same");
        done();
      })
    });
  });

  it("Transit bet round to commit round after 1 second", function(done) {

    Lottery.new({ from: acc1 }).then(function(lot) {

      var bet = web3.toBigNumber(web3.toWei(0.05, 'ether'));

      lot.buyTicket(3, hash, { from: acc2, value: bet }).then(function() {
        return lot.round.call(); 
      }).then(function(round) { 
        assert.equal(round, "0", "Round should be bet round");
        setTimeout(function() {
          // someone calls after 4 seconds
          lot.stubSendNum(2).then(function(res) {
            lot.round.call().then(function(round) {
              assert.equal(round, "1", "Round should be commit round");
              done();
            })            
          })
        }, 4000); 
      }).catch(done);
    }).catch(done);
  });

  it("Send different commitment number and get refund", function(done) {

    Lottery.new({ from: acc1 }).then(function(lot) {

      var bet = web3.toBigNumber(web3.toWei(0.05, 'ether'));
      var balance = web3.eth.getBalance(acc2).toNumber();

      lot.buyTicket(3, hash3, { from: acc2, value: bet }).then(function() {
        return lot.round.call();
      }).then(function(round) {
        assert.equal(round, "0", "Round should be bet round");
        return lot.stubChangeCommitRound();
      }).then(function() {
        return lot.round.call();
      }).then(function(round) {
        assert.equal(round, "1", "Round should be commit round");
        return lot.sendCommitNumber(3, { from: acc2 }); // send wrong commit
      }).then(function() {
        return lot.stubCloseCommitRound();
      }).then(function() {
        balance = web3.eth.getBalance(acc2).toNumber();
        return lot.claimRefunds({ from: acc2 });
      }).then(function() {
        return lot.jackpot.call();
      }).then(function(pot) {
        var currentBalance = web3.eth.getBalance(acc2).toNumber();
        var diffBalance = currentBalance - balance;
        assert(Number(pot) - diffBalance < 2500000000000000, "Amount refunded should be equal to pot");

        var contractBalance = web3.eth.getBalance(lot.address).toNumber();
        assert.equal(contractBalance, 0, "Contract account should be empty")
        done();
      }).catch(done);
    }).catch(done);
  }); 

  it("Send commitment, claimRefunds returning 0 and claimWinnings", function(done) {

    Lottery.new({ from: acc1 }).then(function(lot) {

      var bet = web3.toBigNumber(web3.toWei(0.05, 'ether'));
      var balance = web3.eth.getBalance(acc2).toNumber();
      
      lot.buyTicket(0, hash3, { from: acc2, value: bet }).then(function() {
        return lot.round.call();
      }).then(function(round) {
        assert.equal(round, "0", "Round should be bet round");
        return lot.stubChangeCommitRound();
      }).then(function() {
        return lot.round.call();
      }).then(function(round) {
        assert.equal(round, "1", "Round should be commit round");
        return lot.sendCommitNumber(2, { from: acc2 });
      }).then(function() {
        balance = web3.eth.getBalance(acc2).toNumber();
        console.log("Balance before claimRefunds: " + balance);
        return lot.claimRefunds({ from: acc2 });
      }).then(function() {
        return lot.jackpot.call();
      }).then(function(pot) {
        var currentBalance = web3.eth.getBalance(acc2).toNumber();
        console.log("Balance after claimRefunds: " + currentBalance);
        var diffBalance = balance - currentBalance;
        assert(diffBalance < 2500000000000000, "Amount refunded should be 0");
        assert.equal(Number(pot), bet, "Pot should still remain the same");
        return lot.stubChangeClaimRound();
      }).then(function() {
        balance = web3.eth.getBalance(acc2).toNumber();
        console.log("Balance before claimWinnings: " + balance);
        return lot.claimWinnings({ from: acc2 });
      }).then(function() {
        return lot.jackpot.call();
      }).then(function(pot) {
        var currentBalance = web3.eth.getBalance(acc2).toNumber();
        var diffBalance = currentBalance - balance;
        console.log("Balance after claimWinnings: " + currentBalance);
        assert(Number(pot) - diffBalance < 3000000000000000, "Amount credited should equal jackpot");
        var contractBalance = web3.eth.getBalance(lot.address).toNumber();
        assert.equal(contractBalance, 0, "Contract account should be empty")
        done();
      }).catch(done);
    }).catch(done);
  });


  it("When all bets are in, change from commitRound to claimRound", function(done) {

    Lottery.new({ from: acc1 }).then(function(lot) {
      var bet = web3.toWei(0.05, 'ether');
      var bet2 = web3.toWei(0.07, 'ether');

      lot.buyTicket(0, hash3, { from: acc2, value: bet }).then(function() { // commit number 2
        return lot.buyTicket(1, hash2, { from: acc3, value: bet2 }); //commit number 1
      }).then(function() {
        return lot.stubChangeCommitRound();
      }).then(function() { 
        return lot.sendCommitNumber(2, { from: acc2 });          
      }).then(function() {
        return lot.sendCommitNumber(1, { from: acc3 });
      }).then(function() {
        return lot.round.call();
      }).then(function(round) {
        assert.equal(round, "2", "Round should be claim round");
        done();
      }).catch(done);
    }).catch(done);

  });

  it("When not all bets are in, time expires and shift to claim round", function(done) {

    Lottery.new({ from: acc1 }).then(function(lot) {
      var bet = web3.toWei(0.05, 'ether');
      var bet2 = web3.toWei(0.07, 'ether');

      lot.buyTicket(0, hash3, { from: acc2, value: bet }).then(function() { // commit number 2
        return lot.buyTicket(1, hash2, { from: acc3, value: bet2 }); //commit number 1
      }).then(function() {
        return lot.stubChangeCommitRound();
      }).then(function() { 
        return lot.sendCommitNumber(2, { from: acc2 });          
      }).then(function() {
        setTimeout(function() {
          // someone calls after 4 seconds
          lot.claimRefunds({ from: acc2 }).then(function(res) {
            return lot.round.call();
          }).then(function(round) {
            assert.equal(round, "2", "Round should be claim round");
            done();            
          });
        }, 4000); 
      }).catch(done);
    }).catch(done);
  });

  it("Claim winnings", function(done) {

    Lottery.new({ from: acc1 }).then(function(lot) {

      var bet = web3.toWei(0.05, 'ether');
      var bet2 = web3.toWei(0.07, 'ether');
      var firstStart = 0;
      var initialAcc2Balance;
      var acc2Diff;

      lot.buyTicket(0, hash, { from: acc2, value: bet }).then(function() {
        return lot.buyTicket(1, hash2, { from: acc3, value: bet2 });
      }).then(function() {
        newContractBal = web3.eth.getBalance(lot.address).toNumber();
        return lot.stubChangeClaimRound();
      }).then(function() { 
        return lot.stubEndLottery();          
      }).then(function() {
        return lot.moneyBetPool.call();
      }).then(function(moneyBetPool) {
        assert.equal(Number(moneyBetPool), Number(bet), "MoneyBetPool should equal acc1's bet");
        initialAcc2Balance = web3.eth.getBalance(acc2).toNumber();
        return lot.claimWinnings({ from: acc2 });
      }).then(function() {
        var newAcc2Balance = web3.eth.getBalance(acc2).toNumber();
        acc2Diff = newAcc2Balance - initialAcc2Balance;
        return lot.jackpot.call();
      }).then(function(pot) {
        assert(Number(pot) - acc2Diff < 3000000000000000, "Amount credited should equal jackpot");
        var contractBalance = web3.eth.getBalance(lot.address).toNumber();
        assert.equal(contractBalance, 0, "Contract account should be empty")
        done();
      }).catch(done);
    }).catch(done);
  });

});

