import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useWeb3Context } from "../../../hooks";
import { DEFAULD_NETWORK } from "../../../constants";
import { IReduxState } from "../../../store/slices/state.interface";
import { IPendingTxn } from "../../../store/slices/pending-txns-slice";
import "./connect-menu.scss";
import CircularProgress from "@material-ui/core/CircularProgress";

function ConnectMenu() {
    const { connect, disconnect, connected, web3, providerChainID, checkWrongNetwork } = useWeb3Context();
    const dispatch = useDispatch();
    const [isConnected, setConnected] = useState(connected);

    let pendingTransactions = useSelector<IReduxState, IPendingTxn[]>(state => {
        return state.pendingTransactions;
    });

    let buttonText = "Connect Wallet";
    let linkHref = "https://app.unitedfarmers.finance";
    let linkText = "Return";
    let clickFunc: any = connect;
    let buttonStyle = {};
    let linkStyle = {
        backgroundColor: "rgb(89, 67, 67)",
        marginRight: 15,
    };

    if (isConnected) {
        buttonText = "Disconnect";
        clickFunc = disconnect;
    }

    if (pendingTransactions && pendingTransactions.length > 0) {
        buttonText = `${pendingTransactions.length} Pending `;
        clickFunc = () => {};
    }

    if (isConnected && providerChainID !== DEFAULD_NETWORK) {
        buttonText = "Wrong network";
        buttonStyle = { backgroundColor: "rgb(255, 67, 67)" };
        clickFunc = () => {
            checkWrongNetwork();
        };
    }

    useEffect(() => {
        setConnected(connected);
    }, [web3, connected]);

    return (
        <>
            <a className="connect-button" style={linkStyle} href={linkHref} target="_blink">
                <p>{linkText}</p>
            </a>
            <div className="connect-button" style={buttonStyle} onClick={clickFunc}>
                <p>{buttonText}</p>
                {pendingTransactions.length > 0 && (
                    <div className="connect-button-progress">
                        <CircularProgress size={15} color="inherit" />
                    </div>
                )}
            </div>
        </>
    );
}

export default ConnectMenu;
