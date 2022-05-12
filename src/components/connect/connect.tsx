import { FunctionComponent, h } from "preact";

import styles from './connect.css';
import { useState } from "preact/hooks";
import { MikordleChat } from '../../utils/messenger';

type ConnectProps = {
    onSet: (connector: MikordleChat | undefined) => void;
}

const Connect: FunctionComponent<ConnectProps> = ({ onSet }) => {
    const [open, setOpen] = useState<'closed' | 'open' | 'leader' | 'joiner'>('closed');
    const [communicator, setCommunicator] = useState<MikordleChat | undefined>(undefined);

    if (open === 'joiner') {
        let comm = communicator;
        if (comm === undefined) {
            const code = prompt('Enter join code');
            if (code === null) {
                setOpen('open');
                return (<div />);
            } else {
                comm = new MikordleChat(code);
                comm.ready().then(() => comm?.request());
                comm.on('close', () => {
                    setOpen('closed');
                    onSet(undefined);
                    comm?.close();
                });
                onSet(comm);
                setCommunicator(comm);
            }
        }

        return (<div className={styles.connect + ' ' + styles.open}>
            Joined key is: <strong>{comm.identifier}</strong>
            <svg style="width:24px;height:24px" viewBox="0 0 24 24"  onClick={() => {
                onSet(undefined);
                setOpen('closed');
                communicator?.emitClose()
                communicator?.close()
            }}>
                <path fill="currentColor"
                      d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z" />
            </svg>
        </div>)
    }

    if (open === 'leader') {
        if (communicator === undefined) {
            const comm = new MikordleChat();
            comm.on('close', () => {
                onSet(undefined);
                setOpen('closed');
                comm?.close();
            });
            onSet(comm);
            setCommunicator(comm);

            return (<div className={styles.connect + ' ' + styles.open}>
                Your key is: <strong>loading</strong>
            </div>)
        }

        return (<div className={styles.connect + ' ' + styles.open}>
            Your key is: <strong>{communicator.identifier}</strong>
            <svg style="width:24px;height:24px" viewBox="0 0 24 24" onClick={() => {
                onSet(undefined);
                setOpen('closed');
                communicator?.emitClose()
                communicator?.close()
            }}>
                <path fill="currentColor"
                      d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z" />
            </svg>
        </div>);
    }

    if (open === 'open') {
        return (<div className={styles.connect + ' ' + styles.open} onClick={() => setOpen('closed')}>
            <button onClick={() => setOpen('leader')}>Create Session</button>
            <button onClick={() => setOpen('joiner')}>Join Session</button>
        </div>);
    }

    return (
        <div className={styles.connect} onClick={() => setOpen('open')}>
            <svg style="width:24px;height:24px" viewBox="0 0 24 24">
                <path fill="white"
                      d="M11 14H9C9 9.03 13.03 5 18 5V7C14.13 7 11 10.13 11 14M18 11V9C15.24 9 13 11.24 13 14H15C15 12.34 16.34 11 18 11M7 4C7 2.89 6.11 2 5 2S3 2.89 3 4 3.89 6 5 6 7 5.11 7 4M11.45 4.5H9.45C9.21 5.92 8 7 6.5 7H3.5C2.67 7 2 7.67 2 8.5V11H8V8.74C9.86 8.15 11.25 6.5 11.45 4.5M19 17C20.11 17 21 16.11 21 15S20.11 13 19 13 17 13.89 17 15 17.89 17 19 17M20.5 18H17.5C16 18 14.79 16.92 14.55 15.5H12.55C12.75 17.5 14.14 19.15 16 19.74V22H22V19.5C22 18.67 21.33 18 20.5 18Z" />
            </svg>
        </div>
    );
}

export default Connect;
