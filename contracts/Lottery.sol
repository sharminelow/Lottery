pragma solidity ^0.4.2;

contract Lottery {

  enum Rounds {
    betRound,
    commitRound
  }

  struct Ticket {
    address addr;
    uint ticketNum;
    bytes32 commitHash;
    uint256 moneyBet;
  }

  // constants
  Rounds public round = Rounds.betRound;
  uint ticketMax = 4;
  uint public lotteryStart = 0;
  uint public lotteryDuration = 0;
  uint public commitDuration = 0;

  uint256 public jackpot = 0;
  uint[] public winners;
  Ticket[] public tickets;

  function buyTicket(uint chosenNum, bytes32 hash) payable
    atRound(Rounds.betRound) 
    withinRange(chosenNum) {

    if (tickets.length == 0) {
      lotteryStart = now;
    }

    uint256 amount = msg.value;
    tickets.push(Ticket({addr: msg.sender,
                         ticketNum: chosenNum,
                         commitHash: hash,
                         moneyBet: amount }));
    jackpot += amount;

    // check if bidingRound ended
    // isBetRoundClosed()
  }

  modifier atRound(Rounds _round) {
    if (round != _round) throw;
    _;
  }

  modifier withinRange(uint chosenNum) {
      if (chosenNum > ticketMax) throw;
      _;
  }


/*

  function isBetRoundClosed() {
    round = Rounds.commitRound    
  }

   function genWinningNumber() internal returns (uint) {
    
  }

  function endLottery() internal {
    // genWinningNum
    // distributeWinnings
    // reset variables, startLottery
    // announcements
  }

  */
}