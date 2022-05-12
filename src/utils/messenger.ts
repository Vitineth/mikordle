import { GameState } from "../components/mikorle/mikordle";

function generateID(length: number = 20, upper: boolean = true, lower: boolean = true, number: boolean = true) {
    if (!upper && !lower && !number) throw new Error('must have some characters')
    const chars = (
        (lower ? 'abcdefghijklmnopqrstuvwxyz' : '') +
        (upper ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : '') +
        (number ? '0123456789' : '')
    ).split('');

    let output = '';
    for (let i = 0; i < length; i++) {
        output += chars[Math.floor(Math.random() * chars.length)];
    }
    return output;
}

const SIGNALLING_SERVER = 'ws://localhost:8087';

class WebSocketMessenger {

    /**
     * The internal websocket connection for which this wraps
     * @private
     */
    private socket: WebSocket;
    /**
     * The channel on which this socket is connected through the routing server
     * @private
     */
    private readonly channel: string;
    /**
     * The next available message ID
     * @private
     */
    private nextMessageID: number = 0;
    /**
     * The set of message listeners
     * @private
     */
    private listeners: ((data: any, topic: string) => void)[] = [];
    /**
     * The set of listeners waiting for the connection to open
     * @private
     */
    private readyListeners: (Function)[] = [];

    /**
     * Creates a new connection wrapping a basic websocket connection. If the channel is not specified it will create
     * a new one
     * @param url the websocket server
     * @param channel the channel to which this should subscribe or undefined if one should be generated
     */
    constructor(url: string, channel?: string) {
        this.channel = channel ?? generateID(20);
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
            this.socket.send(JSON.stringify({
                topic: '_subscribe',
                message: this.channel,
                id: this.nextMessageID++,
            }));
            this.readyListeners.forEach((e) => e());
        }
        this.socket.onmessage = (event) => {
            try {
                const content = JSON.parse(event.data);
                if (content.topic === '_system') {
                    console.debug('system level message', content);
                    return;
                }

                this.listeners.forEach((h) => h(JSON.parse(content.message), content.topic));
            } catch (e) {
                console.error('Failed to receive message', e);
            }
        }
    }

    send(data: any) {
        this.socket.send(JSON.stringify({
            topic: this.channel,
            message: JSON.stringify(data),
            id: this.nextMessageID++,
        }));
    }

    on(handler: ((data: any, topic: string) => void)) {
        this.listeners.push(handler);
    }

    ready(): Promise<void> {
        if (this.socket.readyState === WebSocket.OPEN) return Promise.resolve();

        return new Promise<void>((resolve) => {
            this.readyListeners.push(resolve);
        });
    }

    close() {
        this.socket.close();
    }

}

class WebRTCCommunicator {

    private signaler: WebSocketMessenger;
    private isReady: boolean = false;
    private readyListeners: Function[] = [];
    private localConnection: RTCPeerConnection;
    private dataChannel: RTCDataChannel | undefined;
    private listeners: ((data: string) => void)[] = [];
    private _identifier: string;

    /**
     * Constructs a new WebRTC chat service. This will connect through websocket via my communicator service and
     * negotiate a WebRTC channel. If the key is provided it will attempt to connect to the given client, if not
     * then it will generate a new key and start waiting for connection.
     * @param key the key that should be connected to, otherwise it will generate one and begin waiting
     */
    constructor(key?: string) {
        this.localConnection = new RTCPeerConnection();

        this._identifier = key ?? generateID(5, true, false, true);
        this.signaler = new WebSocketMessenger(SIGNALLING_SERVER, this._identifier);
        this.signaler.ready().then(() => this.setup(key !== undefined));
    }

    private setup(initiate: boolean) {
        this.signaler.on(async (value: any) => {
            if (typeof (value) !== 'object') return;

            if (!Object.prototype.hasOwnProperty.call(value, 'type')) {
                console.warn('Message type missing', value);
                return;
            }
            if (!Object.prototype.hasOwnProperty.call(value, 'raw')) {
                console.warn('Message raw missing', value);
                return;
            }
            if (typeof (value.type) !== 'string') {
                console.warn('Type is not a string', value);
                return;
            }

            if (value.type === 'ice') {
                await this.localConnection.addIceCandidate(value.raw);
            } else if (value.type === 'sdp') {
                await this.localConnection.setRemoteDescription(value.raw);
                if (value.raw.type === 'offer') {
                    const answer = await this.localConnection.createAnswer();
                    await this.localConnection.setLocalDescription(answer);
                    this.signaler.send({
                        type: 'sdp',
                        raw: answer,
                    });
                }
            } else if (value.type === 'init') {
                const dataChannel = this.localConnection.createDataChannel('comms');
                dataChannel.onopen = () => this.dataChannel = dataChannel;
                this.prepare(dataChannel);

                this.readyListeners.forEach((e) => e());
                this.isReady = true;
            }
        });

        this.localConnection.addEventListener('negotiationneeded', async () => {
            const offer = await this.localConnection.createOffer();
            await this.localConnection.setLocalDescription(offer);
            this.signaler.send({
                type: 'sdp',
                raw: offer,
            });
        });

        this.localConnection.addEventListener('icecandidate', async (e) => {
            if (e.candidate) {
                await this.signaler.send({
                    type: 'ice',
                    raw: e.candidate,
                });
            }
        });

        this.localConnection.addEventListener('datachannel', (ch) => {
            this.dataChannel = ch.channel;
            this.readyListeners.forEach((e) => e());
            this.isReady = true;
            this.prepare(ch.channel);
        });

        if (initiate) {
            this.signaler.send({ type: 'init', raw: '' });
        }
    }

    private prepare(channel: RTCDataChannel) {
        channel.addEventListener('message', (ev) => {
            this.listeners.forEach((e) => e(ev.data));
        });
    }

    ready(): Promise<void> {
        if (this.isReady) return Promise.resolve();

        return new Promise<void>((resolve) => {
            this.readyListeners.push(resolve);
        });
    }

    on(handler: ((data: string) => void)) {
        this.listeners.push(handler);
    }

    send(value: string) {
        if (!this.isReady || !this.dataChannel) throw new Error('not open');
        this.dataChannel.send(value);
    }

    close() {
        this.dataChannel?.close()
        this.localConnection.close();
        this.signaler.close();
    }

    get identifier(): string {
        return this._identifier;
    }
}


export class MikordleChat {

    private communicator: WebRTCCommunicator;
    private listeners: Record<string, ([string, Function])[]> = {};

    constructor(key?: string) {
        this.communicator = new WebRTCCommunicator(key);
        this.communicator.on((data: any) => {
            console.log('recv', data);
            try {
                const parse = JSON.parse(data);
                if (parse.event === 'key-pressed' && Object.prototype.hasOwnProperty.call(this.listeners, 'key-pressed')) {
                    this.listeners['key-pressed'].forEach((e) => e[1](parse.value));
                } else if (parse.event === 'key-removed' && Object.prototype.hasOwnProperty.call(this.listeners, 'key-removed')) {
                    this.listeners['key-removed'].forEach((e) => e[1]());
                } else if (parse.event === 'enter-pressed' && Object.prototype.hasOwnProperty.call(this.listeners, 'enter-pressed')) {
                    this.listeners['enter-pressed'].forEach((e) => e[1]());
                } else if (parse.event === 'initialise' && Object.prototype.hasOwnProperty.call(this.listeners, 'initialise')) {
                    this.listeners['initialise'].forEach((e) => e[1](parse.value));
                } else if (parse.event === 'request' && Object.prototype.hasOwnProperty.call(this.listeners, 'request')) {
                    this.listeners['request'].forEach((e) => e[1]());
                }else if (parse.event === 'close' && Object.prototype.hasOwnProperty.call(this.listeners, 'close')) {
                    this.listeners['close'].forEach((e) => e[1]());
                }
            } catch (e) {
                console.warn('invalid message', e);
            }
        })
    }

    on(key: 'close', handler: () => void): (() => void);
    on(key: 'request', handler: () => void): (() => void);
    on(key: 'initialise', handler: (state: GameState) => void): (() => void);
    on(key: 'key-pressed', handler: (pressed: string) => void): (() => void);
    on(key: 'key-removed', handler: () => void): (() => void);
    on(key: 'enter-pressed', handler: () => void): (() => void);
    on(key: string, handler?: any): (() => void) {
        const id = generateID(20);
        if (Object.prototype.hasOwnProperty.call(this.listeners, key)) {
            this.listeners[key].push([id, handler]);
        } else {
            this.listeners[key] = [[id, handler]];
        }
        return () => this.listeners[key] = this.listeners[key].filter((e) => e[0] !== id);
    }

    keyPressed(key: string) {
        console.log('key-pressed', key);
        this.communicator.send(JSON.stringify({
            event: 'key-pressed',
            value: key,
        }));
    }

    keyRemoved() {
        console.log('key-removed');
        this.communicator.send(JSON.stringify({
            event: 'key-removed',
        }));
    }

    enterPressed() {
        console.log('enter-pressed');
        this.communicator.send(JSON.stringify({
            event: 'enter-pressed',
        }));
    }

    initialise(state: GameState) {
        console.log('initialise');
        this.communicator.send(JSON.stringify({
            event: 'initialise',
            value: state,
        }));
    }

    request() {
        console.log('request');
        this.communicator.send(JSON.stringify({
            event: 'request',
        }));
    }

    ready() {
        return this.communicator.ready();
    }

    close() {
        this.communicator.close();
    }

    emitClose(){
        console.log('close');
        this.communicator.send(JSON.stringify({
            event: 'close',
        }));
    }

    get identifier() {
        return this.communicator.identifier;
    }

}
