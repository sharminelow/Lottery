contract('Lottery', function(accounts) {
	console.log(accounts);
	var acc1 = accounts[0];
  var acc2 = accounts[1];
  var acc3 = accounts[2];
  var gasPrice = 100000000000; // default

  // gas usage for each transaction
  var estContractFee = web3.toBigNumber('85306300000000000');
  var estGasForBetting = web3.toBigNumber('12214300000000000');
  var estGasForBetting2 = web3.toBigNumber('9214300000000000');
  var estEndLottery = web3.toBigNumber('4539000000000000');

  it("Place a bet", function(done) {

    Lottery.new({ from: acc1 }).then(function(lot) {

      var bet = web3.toBigNumber(web3.toWei(0.05, 'ether'));
      var accBal = web3.toBigNumber(web3.eth.getBalance(acc1));
      var initialContractBal = web3.eth.getBalance(lot.address).toNumber();  

      lot.buyBet(4, { from: acc1, value: bet}).then(function() {
        var newContractBal = web3.eth.getBalance(lot.address).toNumber();
        var contractDiff = newContractBal - initialContractBal;

        assert.equal(contractDiff, bet, "Difference in contract balance should be the bet");
        return lot.checkPot.call(); 
      }).then(function(pot) { 
        var endAccBal = web3.toBigNumber(web3.eth.getBalance(acc1));
        var diff = accBal.minus(endAccBal).abs();

        assert.equal(pot, bet.toNumber(), "Jackpot should be equal to bet");
        assert.deepEqual(diff, bet.plus(estGasForBetting), "User1 acc should decrease by bet value and gas");
        done();
      }).catch(done);
    }).catch(done);
  });


  it("Two people place bets", function(done) {

    Lottery.new({ from: acc1 }).then(function(lot) {

      var bet = web3.toWei(0.05, 'ether');
      var bet2 = web3.toWei(0.07, 'ether');

      var initialContractBal = web3.eth.getBalance(lot.address).toNumber(); 

      lot.buyBet(3, { from: acc2, value: bet}).then(function() {
        lot.buyBet(4, { from: acc3, value: bet2}).then(function() {
          var newContractBal = web3.eth.getBalance(lot.address).toNumber();
          var contractDiff = newContractBal - initialContractBal;

          assert.equal(contractDiff, Number(bet) + Number(bet2), "Difference in contract balance should be the bets");
          return lot.checkPot.call(); 
        }).then(function(pot) { 
          assert.equal(Number(pot), Number(bet) + Number(bet2), "pot should be equal to total bets");
          done();
        }).catch(done);
      }).catch(done);
    }).catch(done);
  });

  it("One bet, and wins a bet", function(done) {

    Lottery.new({ from: acc1 }).then(function(lot) {

      var bet = web3.toWei(0.05, 'ether');
      var initialContractBal = web3.eth.getBalance(lot.address).toNumber();  
      var accBal = 0;
      var jackpot = 0;

      lot.buyBet(4, { from: acc2, value: bet}).then(function() {
        var newContractBal = web3.eth.getBalance(lot.address).toNumber();
        var contractDiff = newContractBal - initialContractBal;
        accBal = web3.eth.getBalance(acc2).toNumber();

        assert.equal(contractDiff, bet, "Difference in contract balance should be the bet");        
        return lot.jackpot.call();
      }).then(function(pot) { 
        jackpot = pot;           
        return lot.stubEndLottery();        
      }).then(function() {
        var newAccBal = web3.eth.getBalance(acc2).toNumber();
        var diff = newAccBal - accBal;
        var contractBal = web3.eth.getBalance(lot.address).toNumber();

        assert.equal(contractBal, 0, "contract should have 0 after paying");
        assert.equal(diff, Number(jackpot), "acc2 should increase by jackpot amount");
        done();
      }).catch(done);
    }).catch(done);
  });

  it("Three bet, and one wins a bet", function(done) {

    Lottery.new({ from: acc1 }).then(function(lot) {
      var bet = web3.toBigNumber(web3.toWei(0.05, 'ether'));

      var user1Bal = web3.toBigNumber(web3.eth.getBalance(acc1));  
      var user2Bal = web3.toBigNumber(web3.eth.getBalance(acc2));  
      var user3Bal = web3.toBigNumber(web3.eth.getBalance(acc3)); 
      var initialContractBal = web3.eth.getBalance(lot.address).toNumber();  

      var user1Bet = lot.buyBet(4, {from: acc1, value: bet});
      var user2Bet = lot.buyBet(1, {from: acc2, value: bet});
      var user3Bet = lot.buyBet(1, {from: acc3, value: bet});

      user1Bet.then(user2Bet).then(user2Bet).then(function() {
        return lot.jackpot.call();
      }).then(function(jackpot) {
        var contractBal = web3.eth.getBalance(lot.address).toNumber();  
        assert.equal(Number(jackpot), bet*3, "jackpot should be the sum of all bets");
        assert.equal(contractBal, bet*3, "contract should have the sum of all bets");

        return lot.stubEndLottery({from: acc2});
      }).then(function() {            
        var user1EndBal = web3.toBigNumber(web3.eth.getBalance(acc1));  
        var user2EndBal = web3.toBigNumber(web3.eth.getBalance(acc2));  
        var user3EndBal = web3.toBigNumber(web3.eth.getBalance(acc3)); 

        var user1Diff = user1EndBal.minus(user1Bal);
        var user2Diff = user2EndBal.minus(user2Bal).abs();
        var user3Diff = user3EndBal.minus(user3Bal).abs();

        assert.deepEqual(user1Diff, bet.times(2).minus(estGasForBetting), "user1 should win 0.10 ether, minus gas paid");
        assert.deepEqual(user2Diff, bet.plus(estGasForBetting2).plus(estEndLottery), "user 2 should lose 0.05 ether, gas paid, contract fee");
        assert.deepEqual(user3Diff, bet.plus(estGasForBetting2), "user3 should lose 0.05 ether and gas paid");
        done();
      }).catch(done);
    }).catch(done);
  });

});

