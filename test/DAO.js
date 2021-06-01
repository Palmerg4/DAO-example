const { time } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');
const DAO = artifacts.require('DAO');
const truffleAssert = require('truffle-assertions');

contract('DAO', (accounts) => {
    let dao;

    const [investor1, investor2, investor3] = [accounts[1], accounts[2], accounts[3]];
    before(async () => {
        dao = await DAO.new(2, 2, 50);
    });

    it('Should accept contribution from investor', async () => {
        await dao.contribute({ from: investor1, value: 100 });
        await dao.contribute({ from: investor2, value: 200 });
        await dao.contribute({ from: investor3, value: 300 });

        const shares1 = await dao.shares(investor1);
        const shares2 = await dao.shares(investor2);
        const shares3 = await dao.shares(investor3);
        const isInvestor1 = await dao.investors(investor1);
        const isInvestor2 = await dao.investors(investor2);
        const isInvestor3 = await dao.investors(investor3);
        const totalShares = await dao.totalShares();
        const availableFunds = await dao.availableFunds();

        assert(shares1.toNumber() === 100);
        assert(shares2.toNumber() === 200);
        assert(shares3.toNumber() === 300);
        assert(isInvestor1 === true);
        assert(isInvestor2 === true);
        assert(isInvestor3 === true);
        assert(totalShares.toNumber() === 600);
        assert(availableFunds.toNumber() === 600);
    });

    it('Should Not accept contribution after contributionTime ends', async () => {
        await time.increase(2001);
        await truffleAssert.reverts(
            dao.contribute({ from: investor1, value: 100 }), 'Cannot contribute after contributionEnd'
        );
    });

    it('Should create a proposal', async () => {
        await dao.createProposal('proposal 1', 100, accounts[8], { from: investor1 });
        const proposal = await dao.proposals(0);
        assert(proposal.name === 'proposal 1');
        assert(proposal.recipient === accounts[8]);
        assert(proposal.amount.toNumber() === 100);
        assert(proposal.votes.toNumber() === 0);
        assert(proposal.executed === false);
    });

    it('Should NOT create proposal if not from an investor', async () => {
        await truffleAssert.reverts(
            dao.createProposal('proposal 2', 10, accounts[8], { from: accounts[5] }), 'Only investors'
        );
    });

    it('Should NOT create proposal if amount is too big', async () => {
        await truffleAssert.reverts(
            dao.createProposal('proposal 2', 1000, accounts[8], { from: investor1 }), 'Amount too large'
        );
    });

    it('Should cast vote for investor' , async () => {
        await dao.vote(0, { from: investor1 });
    });

    it('Should NOT cast vote for non-investor', async () => {
        await truffleAssert.reverts(
            dao.vote(0, { from: accounts[8] }), 'Only investors'
        );
    });

    it('Should NOT vote if investor already placed vote', async () => {
        await truffleAssert.reverts(
            dao.vote(0, { from: investor1 }), 'Investor can only vote once per proposal'
        );
    });

    it('Should NOT vote if proposal has ended', async () => {
        await time.increase(2001);
        truffleAssert.reverts(
            dao.vote(0, { from: investor1 }), 'Proposal has closed'
        );
    });

    it('Should execute proposal', async () => {
        await dao.createProposal('proposal 2', 100, accounts[8], { from: investor1 });
        await dao.vote(1, { from: investor1 }); //100 shares
        await dao.vote(1, { from: investor3 }); //300 shares
        await time.increase(2001);
        await dao.executeProposal(2);
    });

    it('Should NOT execute proposal if not enough votes', async () => {
        await dao.createProposal('proposal 3', 100, accounts[8], { from: investor1 });
        await dao.vote(2, { from: investor1 }); //100 shares
        await time.increase(2001);
        await truffleAssert.reverts(
            dao.executeProposal(2), 'Cannot execute proposal with votes < quorum'
        );
    });

    it('Should NOT execute proposal before end date', async () => {
        await dao.createProposal('proposal 4', 50, accounts[8], { from: investor1 });
        await dao.vote(3, { from: investor1 });
        await dao.vote(3, { from: investor2 });
        await truffleAssert.reverts(
            dao.executeProposal(3), 'Cannot execute a proposal before end date'
        );
    });

    it('Should withdraw ether', async () => {
        const balanceBefore = await web3.eth.getBalance(accounts[8]);
        await dao.withdrawEther(10, accounts[8]);
        const balanceAfter = await web3.eth.getBalance(accounts[8]);
        balanceAfterBN = web3.utils.toBN(balanceAfter);
        balanceBeforeBN = web3.utils.toBN(balanceBefore);
        assert(balanceAfterBN.sub(balanceBeforeBN).toNumber() === 10);
    });

    it('Should NOT withdraw ether if not admin', async () => {
        await truffleAssert.reverts(
            dao.withdrawEther(10, accounts[8], { from: investor1 }), 'Only admin'
        );
    });

    it('Should NOT withdraw ether if trying to withdraw too much', async () => {
        await truffleAssert.reverts(
            dao.withdrawEther(1000, accounts[8]), 'Not enough avaiable funds'
        );
    });
});