contract('Lottery', function(accounts) {
	console.log(accounts);
	var acc1 = accounts[0];
  var acc2 = accounts[1];
  var acc3 = accounts[2];

   function checkAllGasSpent(gasAmount, gasPrice, account, prevBalance){
       var newBalance = web3.eth.getBalance(account);
       assert.equal(prevBalance.minus(newBalance).toNumber(), gasAmount*gasPrice, 'Incorrect amount of gas used');
   }

  it("Place a bet", function(done) {

  	Lottery.new({ from: acc1 }).then(
  		function(lot) {

        var bet = web3.toWei(5, 'ether');
        var initialContractBal = web3.eth.getBalance(lot.address).toNumber();  

  			lot.buyBet(4, { from: acc2, value: bet}).then(
          function() {
            var newContractBal = web3.eth.getBalance(lot.address).toNumber();
            var contractDiff = newContractBal - initialContractBal;
  					assert.equal(contractDiff, bet, "Difference in contract balance should be the bet");
  					return lot.checkPot.call(); 
  			}).then(
  				function(pot) { 
  					assert.equal(pot, bet, "jackpot should be equal to bet");
            done();
  			}).catch(done);
  	}).catch(done);
  });


  it("Two people place bets", function(done) {

    Lottery.new({ from: acc1 }).then(
      function(lot) {

        var bet = web3.toWei(0.05, 'ether');
        var bet2 = web3.toWei(0.07, 'ether');

        var initialContractBal = web3.eth.getBalance(lot.address).toNumber(); 

        lot.buyBet(3, { from: acc2, value: bet}).then(
          function() {
            lot.buyBet(4, { from: acc3, value: bet2}).then(
              function() {
                var newContractBal = web3.eth.getBalance(lot.address).toNumber();
                var contractDiff = newContractBal - initialContractBal;
                assert.equal(contractDiff, Number(bet) + Number(bet2), "Difference in contract balance should be the bets");
                return lot.checkPot.call(); 
            }).then(
              function(pot) { 
                assert.equal(Number(pot), Number(bet) + Number(bet2), "pot should be equal to total bets");
                done();
            }).catch(done);
        }).catch(done);
    }).catch(done);
  });

  it("One bet, and wins a bet", function(done) {

    Lottery.new({ from: acc1 }).then(
      function(lot) {

        var bet = web3.toWei(0.05, 'ether');
        var initialContractBal = web3.eth.getBalance(lot.address).toNumber();  
        var accBal = 0;
        var jackpot = 0;

        lot.buyBet(4, { from: acc2, value: bet}).then(
          function() {
            var newContractBal = web3.eth.getBalance(lot.address).toNumber();
            var contractDiff = newContractBal - initialContractBal;
            assert.equal(contractDiff, bet, "Difference in contract balance should be the bet");
            
            accBal = web3.eth.getBalance(acc2).toNumber();
            console.log("before: " + accBal);

            return lot.jackpot.call();
        }).then(
          function(pot) { 
            jackpot = pot;           
            return lot.stubEndLottery();        
        }).then(
          function() {
            var newAccBal = web3.eth.getBalance(acc2).toNumber();
            var diff = newAccBal - accBal;
            var contractBal = web3.eth.getBalance(lot.address).toNumber();
            console.log("after:  " + newAccBal);

            assert.equal(contractBal, 0, "contract should be 0 after paying");
            assert.equal(diff, Number(jackpot), "acc2 should increase by jackpot amount");
            done();
        }).catch(done);
    }).catch(done);
  });

/*  it("Three bet, and one wins a bet", function(done) {

    Lottery.new({ from: acc1 }).then(
      function(lot) {

        var bet = web3.toWei(0.05, 'ether');

        var user1Bet = lot.buyBet(4, {from: acc1, value: bet});
        var user2Bet = lot.buyBet(1, {from: acc2, value: bet});
        var user3Bet = lot.buyBet(1, {from: acc3, value: bet});

        var initialContractBal = web3.eth.getBalance(lot.address).toNumber();  
        var accBal = 0;

        user1Bet.then(user2Bet).then(user2Bet).then(
          function() {
            return lot.jackpot.call();
        }).then(function(jackpot) {
          console.log(jackpot);
        }).catch(done);

        lot.buyBet(4, { from: acc2, value: bet}).then(
          function() {
            var newContractBal = web3.eth.getBalance(lot.address).toNumber();
            var contractDiff = newContractBal - initialContractBal;
            assert.equal(contractDiff, bet, "Difference in contract balance should be the bet");
            
            accBal = web3.eth.getBalance(acc2).toNumber();
            console.log("before: " + accBal);

            return lot.stubEndLottery();
        }).then(
          function() {            
            return lot.jackpot.call();
        }).then(
          function(jackpot) {
            console.log("after:  " + newAccBal);
            console.log("after:  " + jackpot);
            
            var newAccBal = web3.eth.getBalance(acc2).toNumber();
            var diff = newAccBal - accBal;
            var contractBal = web3.eth.getBalance(lot.address).toNumber();

            assert.equal(contractBal, 0, "contract should be 0 after paying");
            assert.equal(jackpot, 0, "jackpot should be 0 after paying");
            assert.equal(diff, Number(jackpot), "acc2 should increase by jackpot amount");
            done();
        }).catch(done);
    }).catch(done);
  });
*/
});

