contract('Lottery', function(accounts) {
	console.log(accounts);
	var acc1 = accounts[0];
  var acc2 = accounts[1];
  var acc3 = accounts[2];
  var gasPrice = 100000000000; // default
  var hash = 'd4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35'; // hash for number 2
  var hash2 = '12378112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb';

  it("Buy a ticket", function(done) {

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

  it("Buy ticket number that is out of bounds", function(done) {

    Lottery.new({ from: acc1 }).then(function(lot) {

      var bet = web3.toBigNumber(web3.toWei(0.05, 'ether'));

      lot.buyTicket(10, hash, { from: acc2, value: bet })
      .catch(function(err) {
        assert.notEqual(err, null, "Error should exist");
        done();
      })
    });
  });

  it("Two people buy tickets with same hash", function(done) {

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

  it("Two people buy tickets with diff hash", function(done) {

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

  it("Change to commit round", function(done) {

    Lottery.new({ from: acc1 }).then(function(lot) {
      lot.stubChangeCommitRound().then(function() {
        lot.round.call().then(function(round) {
          assert.equal(round, "1", "Round should be commit round");
          done();
        })
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

});

