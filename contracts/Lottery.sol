pragma solidity ^0.4.2;

contract Lottery {

  enum Rounds {
    betRound,
    commitRound,
    claimRound
  }

  struct Ticket {
    address addr;
    uint ticketNum;
    bytes32 commitHash;
    uint256 moneyBet;
  }

  struct Commitment {
    address addr;
    uint commitNum;
  }

  // constants
  Rounds public round = Rounds.betRound;
  uint ticketMax = 4;
  uint lotteryStart = 0;
  uint commitStart = 0;
  uint claimStart = 0;
  uint lotteryDuration = 10;
  uint commitDuration = 10;
  uint claimDuration = 1209600;

  uint256 public jackpot = 0;
  address[] players;
  Ticket[] tickets;
  Commitment[] commitments;
  bool[] committed;
  bool[] won;
  Ticket[] successfulTickets;
  Commitment[] successfulCommitments;

  function buyTicket(uint chosenNum, bytes32 hash) payable
    atRound(Rounds.betRound) 
    isUniqueHash(hash)
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

    // check if bettingRound ended
    if(isBetRoundClosed() == true) {
      round = Rounds.commitRound;
      commitStart = now;
    }
  }

  function isBetRoundClosed() returns (bool) {
    return ((now - lotteryStart) > lotteryDuration);
  }

  modifier isUniqueHash(bytes32 hash) {
    uint length = tickets.length;
    for (uint i = 0; i < length; i++) {
      if (tickets[i].commitHash == hash)
        throw;
    }
    _;
  }

  modifier atRound(Rounds _round) {
    if (round != _round) throw;
    _;
  }

  modifier withinRange(uint chosenNum) {
    if (chosenNum > ticketMax) throw;
    _;
  }

  function sendCommitNumber(uint num) atRound(Rounds.commitRound) {
    commitments.push(Commitment({addr: msg.sender, commitNum: num}));
    if (isCommitRoundClosed()) {
      checkCommitments();
    }
  }

  function isCommitRoundClosed() returns (bool) {
    return ((now - commitStart) > commitDuration);
  }

  function checkCommitments() internal {

    uint numOfBets = tickets.length;
    uint amountOfRevealedBets = 0;

    for(uint t = 0; t < tickets.length; t++) {
      for(uint c = 0; c < commitments.length; c++) {
        if(sha256(commitments[c].commitNum) == tickets[t].commitHash && 
          commitments[c].addr == tickets[t].addr) {
          amountOfRevealedBets += tickets[t].moneyBet;
          //committed[t] = 1; break; else commited[t] = 0;
          successfulTickets.push(tickets[t]);
          successfulCommitments.push(commitments[c]);
          break;
        }
      }
    }

    if(successfulTickets.length == 0) {
      for(uint i = 0; i < tickets.length; i++) {
        //put into claim-account instead
        //tickets[i].addr.send(tickets[i].moneyBet);
      }
    } else if(numOfBets - successfulTickets.length > 0) {
      uint finesToBeDistributed = (jackpot - amountOfRevealedBets) / successfulTickets.length;

      for(i = 0; i < successfulTickets.length; i++) {
        //put into claim-account instead
        //successfulTickets[i].addr.send(successfulTickets[i].moneyBet + finesToBeDistributed);
      }																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																																		
    } else {
      tickets = successfulTickets;
      commitments = successfulCommitments;
      determineWinners();
    }
  }																																															

  function genWinningNumber() internal returns (uint) {
    return 0;
/*
    uint currentBlockNumber = block.number;
    bytes32 xorBlockHashes = 0;
    uint xorCommitmentNumber = 0;

    for(uint i = 0; i < 3; i++) {
  																																																																																											    xorBlockHashes = xorBlockHashes ^ block.blockhash(currentBlockNumber - i);
    }

    for(i = 0; i < commitments.length; i++) {
      xorCommitmentNumber = xorCommitmentNumber ^ commitments[i].commitNum;
    }

    bytes32 commitmentNumberInBytes = bytes32(xorCommitmentNumber);

    bytes32 randomNumberInBytes = xorBlockHashes ^ commitmentNumberInBytes;

    bytes32 last10Bits = randomNumberInBytes & "0x3ff";

    uint winningNumber = last10Bits & "0xfff";

    return winningNumber;   
*/
  }

  function determineWinners() internal {
    uint winningnumber = genWinningNumber();
    //allocate winnings
  }

  //called by lottery people to get their winnings
  function claimWinnings() payable atRound(Rounds.claimRound) {
    uint index = 0;
    while (players[index] != msg.sender && index < players.length) {
      index++;
    }
    //send winnings
    if (isClaimRoundClosed()) {
      endLottery();
    }
  }

  function isClaimRoundClosed() returns (bool) {
    return ((now - claimStart) > claimDuration);
  }

  function endLottery() internal {
    // reset variables, lotteryStart
    lotteryStart = 0;
    commitStart = 0;
    claimStart = 0;
    delete tickets;
    delete commitments;
    delete committed;
    delete won;
    delete successfulTickets;
    delete successfulCommitments;
    round = Rounds.betRound;
    // announcements
    
  }	

}
