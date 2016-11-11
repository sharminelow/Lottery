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
  // i think these shouldn't be public?
  uint lotteryStart = 0;
  uint commitStart = 0;
  uint claimStart = 0;
  uint lotteryDuration = 10;
  uint commitDuration = 10;
  uint claimDuration = 1209600;

  uint256 public jackpot = 0;
  mapping(address => Ticket[]) public winners;
  mapping(address => Ticket[]) public claimers;
  Ticket[] tickets;
  Commitment[] commitments;
  Ticket[] successfulTickets;
  Commitment[] successfulCommitments;

  uint256 public moneyBetPool = 0;

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

  // stub method
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
      //  if(sha256(commitments[c].commitNum ^ commitments[c].addr) == tickets[t].commitHash && commitments[c].addr == tickets[t].addr) {
        if(sha256(commitments[c].commitNum) == tickets[t].commitHash && commitments[c].addr == tickets[t].addr) {
          amountOfRevealedBets += tickets[t].moneyBet;
          successfulTickets.push(tickets[t]);
          successfulCommitments.push(commitments[c]);
          break;
        }
      }
    }

    if(successfulTickets.length == 0) {
      for(uint i = 0; i < tickets.length; i++) {
        claimers[tickets[i].addr].push(tickets[i]);
      }
    } else if(numOfBets - successfulTickets.length > 0) {
      for(i = 0; i < successfulTickets.length; i++) {
        claimers[successfulTickets[i].addr].push(successfulTickets[i]);
      }
    } else {
      tickets = successfulTickets;
      commitments = successfulCommitments;
      endLottery();
    }

  }

  function claimRefunds() payable {
    for(uint i = 0; i < claimers[msg.sender].length; i++) {
      uint256 amtRefund = claimers[msg.sender][i].moneyBet;
      delete claimers[msg.sender][i];
      if (!msg.sender.send(amtRefund)) {
        throw;
      }
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

    for(uint i = 0; i < commitments.length; i++) {
      xorCommitmentNumber = xorCommitmentNumber ^ commitments[i].commitNum;
    }

    bytes32 commitmentNumberInBytes = bytes32(xorCommitmentNumber);

    bytes32 randomNumberInBytes = xorBlockHashes ^ commitmentNumberInBytes;

    bytes32 last10Bits = randomNumberInBytes & "0x3ff";

    uint winningNumber = last10Bits & "0xfff";

    return winningNumber;
  */
  }
  
  // Ends lottery round (should be changed to internal after integrating)
  function endLottery() {
    // generate winning number
    // uint winningNum = genWinningNumber();
    uint winningNum = 1; // Hardcoded until genWinningNumber() is ready
    
    jackpot = 0;
    // determine winners, jackpot and moneyBet pool
    for(uint i = 0; i < tickets.length; i++) {
      jackpot += tickets[i].moneyBet;
      if(tickets[i].ticketNum == winningNum) {
        winners[tickets[i].addr].push(tickets[i]);
        moneyBetPool += tickets[i].moneyBet;
      }
    }

    // reset variables
    // startLottery
    // announcements
  }

  // Claims all winnings for the particular user
  function claimWinnings() payable {
    for(uint i = 0; i < winners[msg.sender].length; i++) {
      uint256 amtWon = winners[msg.sender][i].moneyBet / moneyBetPool * jackpot;
      delete winners[msg.sender][i];
      if (!msg.sender.send(amtWon)) {
        throw;
      }
    }
  }
}

