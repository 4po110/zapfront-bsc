import { JsonRpcProvider, StaticJsonRpcProvider } from "@ethersproject/providers";
import { createAsyncThunk, Dispatch } from "@reduxjs/toolkit";
import { messages } from "../../constants/messages";
import { getAddresses, Networks } from "../../constants";
import { IToken } from "../../helpers/tokens";
import { info, success, warning } from "./messages-slice";
import { clearPendingTxn, fetchPendingTxns } from "./pending-txns-slice";
import { metamaskErrorWrap } from "../../helpers/metamask-error-wrap";
import { getGasPrice } from "../../helpers/get-gas-price";
import { ethers } from "ethers";
import { MimTokenContract, ZapinContract } from "../../abi";
import { calculateUserBondDetails, fetchAccountSuccess } from "./account-slice";
import { IAllBondData } from "../../hooks/bonds";
import { zapinData, zapinLpData } from "../../helpers/zapin-fetch-data";
import { trim } from "../../helpers/trim";
import { sleep } from "../../helpers";

interface IChangeApproval {
    token: IToken;
    provider: StaticJsonRpcProvider | JsonRpcProvider;
    address: string;
    networkID: Networks;
}

export const changeApproval = createAsyncThunk("zapin/changeApproval", async ({ token, provider, address, networkID }: IChangeApproval, { dispatch }) => {
    if (!provider) {
        dispatch(warning({ text: messages.please_connect_wallet }));
        return;
    }
    const addresses = getAddresses(networkID);

    const signer = provider.getSigner();

    const tokenContract = new ethers.Contract(token.address, MimTokenContract, signer);

    let approveTx;
    try {
        const gasPrice = await getGasPrice(provider);

        approveTx = await tokenContract.approve("0x83896c22ff6616C33b51e9DD0cf0B8032624c3c6", ethers.constants.MaxUint256, { gasPrice });

        const text = "Approve " + token.name;
        const pendingTxnType = "approve_" + token.address;

        dispatch(fetchPendingTxns({ txnHash: approveTx.hash, text, type: pendingTxnType }));
        await approveTx.wait();
        dispatch(success({ text: messages.tx_successfully_send }));
    } catch (err: any) {
        return metamaskErrorWrap(err, dispatch);
    } finally {
        if (approveTx) {
            dispatch(clearPendingTxn(approveTx.hash));
        }
    }

    await sleep(2);

    const tokenAllowance = await tokenContract.allowance(address, "0x83896c22ff6616C33b51e9DD0cf0B8032624c3c6");

    return dispatch(
        fetchAccountSuccess({
            tokens: {
                [token.name]: {
                    allowance: Number(tokenAllowance),
                },
            },
        }),
    );
});

interface ITokenZapin {
    token: IToken;
    provider: StaticJsonRpcProvider | JsonRpcProvider;
    networkID: Networks;
    bond: IAllBondData;
    slippage: number;
    value: string;
    dispatch: Dispatch<any>;
}

export interface ITokenZapinResponse {
    swapTarget: string;
    swapData: string;
    amount: string;
    value: string;
}

export const calcZapinDetails = async ({ token, provider, networkID, bond, value, slippage, dispatch }: ITokenZapin): Promise<ITokenZapinResponse> => {
    let swapTarget: string = "";
    let swapData: string = "";
    let amount: string = "";

    const acceptedSlippage = slippage / 100 || 0.02;

    if (!provider) {
        dispatch(warning({ text: messages.please_connect_wallet }));
        return {
            swapTarget,
            swapData,
            amount,
            value,
        };
    }

    if (acceptedSlippage < 0.001) {
        dispatch(warning({ text: messages.slippage_too_small }));
        return {
            swapTarget,
            swapData,
            amount,
            value,
        };
    }

    if (acceptedSlippage > 1) {
        dispatch(warning({ text: messages.slippage_too_big }));
        return {
            swapTarget,
            swapData,
            amount,
            value,
        };
    }

    const valueInWei = trim(Number(value) * Math.pow(10, token.decimals));

    try {
        if (bond.isLP) {
            [swapTarget, swapData, amount] = await zapinLpData(bond, token, valueInWei, networkID, acceptedSlippage);
        } else {
            [swapTarget, swapData, amount] = await zapinData(bond, token, valueInWei, networkID, acceptedSlippage);
        }
    } catch (err) {
        metamaskErrorWrap(err, dispatch);
    }

    return {
        swapTarget,
        swapData,
        amount,
        value,
    };
};

interface IZapinMint {
    provider: StaticJsonRpcProvider | JsonRpcProvider;
    networkID: Networks;
    bond: IAllBondData;
    token: IToken;
    value: string;
    slippage: number;
    address: string;
}

export const zapinMint = createAsyncThunk("zapin/zapinMint", async ({ provider, networkID, bond, token, value, slippage, address }: IZapinMint, { dispatch }) => {
    if (!provider) {
        dispatch(warning({ text: messages.please_connect_wallet }));
        return;
    }
    const acceptedSlippage = slippage / 100 || 0.02;
    const addresses = getAddresses(networkID);
    // const depositorAddress = address;

    const signer = provider.getSigner();
    const zapinContract = new ethers.Contract("0x83896c22ff6616C33b51e9DD0cf0B8032624c3c6", ZapinContract, signer);

    const bondAddress = bond.getAddressForReserve(networkID);
    const valueInWei = trim(Number(value) * Math.pow(10, token.decimals));

    const bondContract = bond.getContractForBond(networkID, signer);

    const currentDate = new Date();
    const timestamp = (currentDate.getTime() / 1000).toFixed() + 100000;

    // const calculatePremium = await bondContract.bondPrice();
    // const maxPremium = Math.round(calculatePremium * (1 + acceptedSlippage));

    const path = [token.address, "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"];
    let path1, path2;

    if (bondAddress == "0xd8d18a4045adadec926e0a3c289e22850993ca7b") {
        path1 = ["0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", "0x44b3efa6c6ca47badb3197b0ab675e4396e40023"];
        path2 = [];
    }

    if (bondAddress == "0xcc6a01db54d19e07626bae15dcf870107fbb7d0e") {
        path1 = ["0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", "0x44b3efa6c6ca47badb3197b0ab675e4396e40023"];
        path2 = ["0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", "0x6aa5927e752b54bb4809d616a52af52b650fc731"];
    }

    if (bondAddress == "0x27b56c126bff4c7f952746557752d8de28bca7ec") {
        path1 = ["0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", "0x6aa5927e752b54bb4809d616a52af52b650fc731"];
        path2 = [];
    }

    let zapinTx;
    const gasPrice = await getGasPrice(provider);
    try {
        zapinTx = await zapinContract.Zapin(token.address, valueInWei, path, path1, path2, 61, timestamp);
        dispatch(
            fetchPendingTxns({
                txnHash: zapinTx.hash,
                text: "Zapin " + token.name,
                type: "zapin_" + token.name + "_" + bond.name,
            }),
        );
        await zapinTx.wait();
        dispatch(success({ text: messages.tx_successfully_send }));
        await sleep(0.01);
        // dispatch(info({ text: messages.your_balance_update_soon }));
        await sleep(10);
        await dispatch(calculateUserBondDetails({ address, bond, networkID, provider }));
        // dispatch(info({ text: messages.your_balance_updated }));
        return;
    } catch (err) {
        return metamaskErrorWrap(err, dispatch);
    } finally {
        if (zapinTx) {
            dispatch(clearPendingTxn(zapinTx.hash));
        }
    }
});
