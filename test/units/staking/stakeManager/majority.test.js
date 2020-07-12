import { checkPoint } from "../../../helpers/utils.js";
import { wallets, freshDeploy, approveAndStake } from "../deployment";

contract("StakeManager", async function (accounts) {
  let owner = accounts[0];

  describe("Consensus test", function () {
    beforeEach("fresh deploy", doDeploy);

    // Provisions 3 wallets as validators
    const _initialStakers = [wallets[1], wallets[2], wallets[3]];
    const initialStakeAmount = web3.utils.toWei("200");

    async function doDeploy() {
      await freshDeploy.call(this);

      await this.stakeManager.updateDynastyValue(8);
      for (const wallet of _initialStakers) {
        await approveAndStake.call(this, {
          wallet,
          stakeAmount: initialStakeAmount,
        });
      }

      console.log(
        "All 3 wallets setup as validators with 200 tokens as initial stake"
      );

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
      this.amount = web3.utils.toWei("300");
      await this.stakeToken.approve(this.stakeManager.address, this.amount, {
        from: wallets[4].getAddressString(),
      });

      console.log("4th wallet approval permissions set");
    }

    // Unstake validator 3
    async function doUnstake() {
      const wallet = wallets[3];
      let user = wallet.getAddressString();

      const validatorId = await this.stakeManager.getValidatorId(user);
      await this.stakeManager.unstake(validatorId, {
        from: user,
      });

      // Wait for 12 epoch time period after unstakeInit
      for (let i = 0; i < 12; i++) {
        await checkPoint(
          _initialStakers,
          this.rootChainOwner,
          this.stakeManager
        );
      }

      console.log("Trying to unstake and claim stake amount ...");

      await this.stakeManager.unstakeClaim(validatorId, {
        from: user,
      });

      console.log("Unstake succeeded");
    }

    it("when bid on unstaked validator slot", async function () {
      await doUnstake.call(this);

      // Check this amount till (40% + 0.6) only
      const validator4Amount = 241;
      const unstakedValidatorID = 3;
      const amount = web3.utils.toWei(validator4Amount.toString());

      console.log("Try starting an auction for unstaked validator slot ...");
      await this.stakeManager.startAuction(
        unstakedValidatorID,
        amount,
        false,
        wallets[4].getPrivateKeyString(),
        {
          from: wallets[4].getAddressString(),
        }
      );

      console.log("Start auction succeeded");

      console.log("Checkpoint init ...");
      let auctionPeriod = (await this.stakeManager.auctionPeriod()).toNumber();

      for (let i = 0; i <= auctionPeriod; i++) {
        await checkPoint(
          _initialStakers,
          this.rootChainOwner,
          this.stakeManager
        );
      }

      console.log("Try confirming auction bid ...");
      await this.stakeManager.confirmAuctionBid(
        unstakedValidatorID,
        this.heimdallFee,
        {
          from: wallets[4].getAddressString(),
        }
      );

      console.log("Confirm bid succeeded");

      console.log("Check the total stake ...");
      const stake = await this.stakeManager.currentValidatorSetTotalStake();
      // If no vulnerability should be 200 + 200 + 0 + 161
      console.log("Total stake now: ", stake);
      const validator4StakePercent = (validator4Amount * 100) / Number(stake);
      console.log("Validator 4 stake pct.: ", validator4StakePercent);
    });
  });
});
