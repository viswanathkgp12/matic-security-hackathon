import { checkPoint } from "../../../helpers/utils.js";
import { wallets, freshDeploy, approveAndStake } from "../deployment";

contract("StakeManager", async function (accounts) {
  let owner = accounts[0];

  describe("Consensus test", function () {
    const _initialStakers = [wallets[1], wallets[2]];
    const initialStakeAmount = web3.utils.toWei("200");

    // Provisions 3 wallets as validators
    async function doDeploy() {
      await freshDeploy.call(this);

      await this.stakeManager.updateDynastyValue(8);
      for (const wallet of _initialStakers) {
        await approveAndStake.call(this, {
          wallet,
          stakeAmount: initialStakeAmount,
        });
      }

      // cooldown period
      let auctionPeriod = (await this.stakeManager.auctionPeriod()).toNumber();
      let currentEpoch = (await this.stakeManager.currentEpoch()).toNumber();
      for (
        let i = currentEpoch;
        i <= auctionPeriod + (await this.stakeManager.dynasty()).toNumber();
        i++
      ) {
        await checkPoint(
          _initialStakers,
          this.rootChainOwner,
          this.stakeManager
        );
      }
      this.amount = web3.utils.toWei("200");
      await this.stakeToken.approve(this.stakeManager.address, this.amount, {
        from: wallets[3].getAddressString(),
      });
    }

    // Unstake validator 3
    async function doUnstake() {
      const wallet = wallets[3];
      let user = wallet.getAddressString();

      const validatorId = await this.stakeManager.getValidatorId(user);
      await this.stakeManager.unstake(validatorId, {
        from: user,
      });

      await checkPoint(_initialStakers, this.rootChainOwner, this.stakeManager);

      await this.stakeManager.unstakeClaim(this.validatorId, {
        from: user,
      });
    }

    describe("malicious 40% majority consensus", function () {
      it("when bid on unstaked validator slot", async function () {
        await doDeploy();
        await doUnstake();

        // Check this amount till (40% + 0.6) only
        const validator4Amount = 241;
        const amount = web3.utils.toWei(`"${validator4Amount}"`);

        await this.stakeManager.startAuction(
          3,
          amount,
          false,
          wallets[4].getPrivateKeyString(),
          {
            from: wallets[4].getAddressString(),
          }
        );

        await checkPoint(
          _initialStakers,
          this.rootChainOwner,
          this.stakeManager
        );

        await this.stakeManager.confirmAuctionBid(
          this.validatorId,
          this.heimdallFee,
          {
            from: this.bidder,
          }
        );

        const stake = await this.stakeManager.currentValidatorSetTotalStake();
        // If no vulnerability should be 200 + 200 + 0 + 161
        console.log("Total stake now: ", stake);
        const validator4StakePercent = validator4Amount*100/Number(stake);
        console.log("Validator 4 stake pct.: ", validator4StakePercent);
      });
    });
  });
});
