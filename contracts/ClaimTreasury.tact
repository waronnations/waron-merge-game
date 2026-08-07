// contracts/ClaimTreasury.tact
// War On Nations — Claim Treasury (Mainnet Production)
// Upgradeable • Pauseable • Full asset migration • Server-signed claims

import "@stdlib/ownable";
import "@stdlib/deploy";

// ── Messages ──────────────────────────────────────────────────────────────

message Upgrade {
    code: Cell? = null;
    data: Cell? = null;
}

message SetPaused {
    paused: Bool;
}

message SetClaimSigner {
    publicKey: Int as uint256;
}

message SetJettonWallets {
    wardogWallet: Address;
    warcatWallet: Address;
}

message SetMinClaim {
    minAmount: Int as coins;
}

message Claim {
    token: Int as uint8;          // 0 = WARDOG, 1 = WARCAT
    amount: Int as coins;
    beneficiary: Address;
    nonce: Int as uint64;
    deadline: Int as uint32;
    signature: Slice;             // 64-byte Ed25519 signature
}

message MigrateAssets {
    to: Address;
}

message(0x7362d09c) JettonTransferNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    sender: Address;
    forwardPayload: Slice as remaining;
}

message(0xf8a7ea5) JettonTransfer {
    queryId: Int as uint64;
    amount: Int as coins;
    destination: Address;
    responseDestination: Address?;
    customPayload: Cell?;
    forwardTonAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

// ── Contract ──────────────────────────────────────────────────────────────

contract ClaimTreasury with Ownable, Deployable {
    owner: Address;
    _version: Int as uint32 = 1;

    paused: Bool = false;
    claimSigner: Int as uint256;
    wardogWallet: Address? = null;
    warcatWallet: Address? = null;
    wardogBalance: Int as coins = 0;
    warcatBalance: Int as coins = 0;
    minClaimAmount: Int as coins = 10_000_000_000; // 10 tokens (9 decimals)

    usedNonces: map<Int, Bool>;

    init(owner: Address, claimSigner: Int as uint256) {
        self.owner = owner;
        self.claimSigner = claimSigner;
    }

    // ── Upgrade ───────────────────────────────────────────────────────────
    receive(msg: Upgrade) {
        self.requireOwner();
        if (msg.code != null) {
            setCode(msg.code!!);
        }
        if (msg.data != null) {
            setData(msg.data!!);
            throw(0);
        }
        self._version += 1;
    }

    // ── Admin controls ────────────────────────────────────────────────────
    receive(msg: SetPaused) {
        self.requireOwner();
        self.paused = msg.paused;
    }

    receive(msg: SetClaimSigner) {
        self.requireOwner();
        self.claimSigner = msg.publicKey;
    }

    receive(msg: SetJettonWallets) {
        self.requireOwner();
        self.wardogWallet = msg.wardogWallet;
        self.warcatWallet = msg.warcatWallet;
    }

    receive(msg: SetMinClaim) {
        self.requireOwner();
        require(msg.minAmount > 0, "Min claim must be positive");
        self.minClaimAmount = msg.minAmount;
    }

    receive(msg: MigrateAssets) {
        self.requireOwner();
        if (self.wardogWallet != null && self.wardogBalance > 0) {
            self.sendJettons(self.wardogWallet!!, msg.to, self.wardogBalance, 0);
            self.wardogBalance = 0;
        }
        if (self.warcatWallet != null && self.warcatBalance > 0) {
            self.sendJettons(self.warcatWallet!!, msg.to, self.warcatBalance, 0);
            self.warcatBalance = 0;
        }
    }

    // ── Receive jettons (top-ups & taxes) ─────────────────────────────────
    receive(msg: JettonTransferNotification) {
        if (self.wardogWallet != null && sender() == self.wardogWallet!!) {
            self.wardogBalance += msg.amount;
            return;
        }
        if (self.warcatWallet != null && sender() == self.warcatWallet!!) {
            self.warcatBalance += msg.amount;
            return;
        }
    }

    // ── Claim (user pays gas) ─────────────────────────────────────────────
    receive(msg: Claim) {
        require(!self.paused, "Treasury is paused");
        require(now() <= msg.deadline, "Claim expired");
        require(msg.amount >= self.minClaimAmount, "Below minimum claim");
        require(msg.token == 0 || msg.token == 1, "Invalid token");
        require(!self.usedNonces.get(msg.nonce), "Nonce already used");

        self.usedNonces.set(msg.nonce, true);

        let data = beginCell()
            .storeUint(msg.token, 8)
            .storeCoins(msg.amount)
            .storeAddress(msg.beneficiary)
            .storeUint(msg.nonce, 64)
            .storeUint(msg.deadline, 32)
            .endCell();

        require(
            checkSignature(data.hash(), msg.signature, self.claimSigner),
            "Invalid claim signature"
        );

        if (msg.token == 0) {
            require(self.wardogBalance >= msg.amount, "Insufficient WARDOG");
            require(self.wardogWallet != null, "WARDOG wallet not set");
            self.wardogBalance -= msg.amount;
            self.sendJettons(self.wardogWallet!!, msg.beneficiary, msg.amount, 0);
        } else {
            require(self.warcatBalance >= msg.amount, "Insufficient WARCAT");
            require(self.warcatWallet != null, "WARCAT wallet not set");
            self.warcatBalance -= msg.amount;
            self.sendJettons(self.warcatWallet!!, msg.beneficiary, msg.amount, 0);
        }
    }

    // ── Internal helper ───────────────────────────────────────────────────
    inline fun sendJettons(jettonWallet: Address, to: Address, amount: Int, queryId: Int) {
        send(SendParameters{
            to: jettonWallet,
            value: ton("0.07"),
            bounce: true,
            body: JettonTransfer{
                queryId: queryId,
                amount: amount,
                destination: to,
                responseDestination: myAddress(),
                customPayload: null,
                forwardTonAmount: 0,
                forwardPayload: emptySlice()
            }.toCell()
        });
    }

    // ── Getters ───────────────────────────────────────────────────────────
    get fun version(): Int { return self._version; }
    get fun isPaused(): Bool { return self.paused; }
    get fun getClaimSigner(): Int { return self.claimSigner; }
    get fun getBalances(): (Int, Int) { return (self.wardogBalance, self.warcatBalance); }
    get fun getJettonWallets(): (Address?, Address?) { return (self.wardogWallet, self.warcatWallet); }
    get fun getMinClaim(): Int { return self.minClaimAmount; }
    get fun isUpgradable(): Bool { return true; }
}

asm fun setCode(code: Cell) { SETCODE }
