pragma solidity ^0.4.2;

contract Lottery {

  struct Bet {
    address addr;
    uint num;
    uint256 moneyBet;
  }

  mapping (address => uint256) winnings;
  uint256 public jackpot = 0;
  uint public numPlayers = 0;
  Bet[] public bets;
  uint[] winners;

  // event LotteryEnded(address winner, uint lotteryNum);

  // needs to check ether balance and deduct
  function buyBet(uint chosenNum) payable {
    uint256 amount = msg.value;
    bets.push(Bet({addr: msg.sender, num: chosenNum, moneyBet: amount }));
    jackpot += amount;
  }

/*   function checkBet(address addr) constant returns (uint) {
    return bets[addr];
  }
*/
  function checkPot() constant returns (uint256) {
    return jackpot;
  }

/**
 * stub methods for testing purposes
 */

  function stubGenWinningNumber() internal returns (uint) {
    return 4;
  }

  //deadline >= block.number
   function stubEndLottery() {
    // gas to be paid by lottery
    uint winningNum = stubGenWinningNumber();
    uint j = 0;

    // note who won, record index
     for(uint i = 0; i < bets.length; i++) { 
      if(bets[i].num == winningNum) {
        winners.push(i);
      }
    }

    // distribute winnings
    uint numWinners = winners.length;
    uint256 share = jackpot/numWinners;

    for(uint k = 0; k < numWinners; k++) {
      uint index = winners[j];
      if(!bets[index].addr.send(share)) {
        throw;
      }
    }

    jackpot = 0; 
    return;
  } 

}