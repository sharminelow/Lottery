contract('Lottery', function(accounts) {
	console.log(accounts);
	var acc1 = accounts[0];
  var acc2 = accounts[1];
  var acc3 = accounts[2];
  var gasPrice = 100000000000; // default
  var hash = 'd4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35'; // hash for number 2
  var hash2 = '12378112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb';

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
        // console.log(diff); // 64664000000000000 to check for gas
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

  it("Send commitment and get refund", function(done) {

    Lottery.new({ from: acc1 }).then(function(lot) {

      var bet = web3.toBigNumber(web3.toWei(0.05, 'ether'));
      var balance = web3.eth.getBalance(acc2).toNumber();

      lot.buyTicket(3, hash, { from: acc2, value: bet }).then(function() {
        return lot.round.call();
      }).then(function(round) {
        assert.equal(round, "0", "Round should be bet round");
        return lot.stubChangeCommitRound();
      }).then(function() {
        return lot.round.call();
      }).then(function(round) {
        assert.equal(round, "1", "Round should be commit round");
        return lot.sendCommitNumber(3, { from: acc2 });
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

/*  it("Send commitment and claimRefunds returning 0", function(done) {

    Lottery.new({ from: acc1 }).then(function(lot) {

      var bet = web3.toBigNumber(web3.toWei(0.05, 'ether'));
      var balance = web3.eth.getBalance(acc2).toNumber();
      
      lot.getCommitHash(2).then(function(hash) {
        console.log(hash);
        lot.buyTicket(0, hash, { from: acc2, value: bet }).then(function() {
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
          return lot.stubCloseCommitRound();
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
          console.log(Number(pot));
          console.log("Balance after claimWinnings: " + currentBalance);
          assert(Number(pot) - diffBalance < 2500000000000000, "Amount credited should equal jackpot");
          var contractBalance = web3.eth.getBalance(lot.address).toNumber();
          assert.equal(contractBalance, 0, "Contract account should be empty")
          done();
        }).catch(done);
      }).catch(done);
    }).catch(done);
  });
*/
  // this time will pass/fail depending on race conditions, but event is emitted
/*  it("ticket purchase event shoud emit", function(done) {

      var lot = Lottery.deployed();
      var bet = web3.toBigNumber(web3.toWei(0.05, 'ether'));
      var watcher = lot.TicketPurchased();

      lot.buyTicket(3, hash, { from: acc2, value: bet }).then(function() {
        watcher.watch(function(error, result){
          if (!error) {
            console.log(result);
            watcher.stopWatching();
            done();
          }
        });
      });

  }).timeout(1000);*/

  it("Claim winnings", function(done) {

    Lottery.new({ from: acc1 }).then(function(lot) {

      var bet = web3.toWei(0.05, 'ether');
      var bet2 = web3.toWei(0.07, 'ether');
      var sumOfBets = Number(bet) + Number(bet2);
      var firstStart = 0;
      var initialAcc2Balance;
      var acc2Diff;

      lot.buyTicket(0, hash, { from: acc2, value: bet }).then(function() {
        return lot.buyTicket(1, hash2, { from: acc3, value: bet2 });
      }).then(function() {
        newContractBal = web3.eth.getBalance(lot.address).toNumber();
        return lot.stubChangeClaimRound();
      }).then(function() { 
        return lot.endLottery();          
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
        assert(Number(pot) - acc2Diff < 2500000000000000, "Amount credited should equal jackpot");
        var contractBalance = web3.eth.getBalance(lot.address).toNumber();
        assert.equal(contractBalance, 0, "Contract account should be empty")
        done();
      }).catch(done);
    }).catch(done);
  });

});

