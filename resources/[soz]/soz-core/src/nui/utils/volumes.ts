import { Howler } from 'howler';

import { InterfaceVolumes, VolumeChannel } from '../../shared/nui/volume';

const volumes: InterfaceVolumes = { master: 1, effects: 1, music: 1, phone: 1, video: 1 };

const clamp = (value: number) => Math.min(1, Math.max(0, value));

const mediaChannels = new WeakMap<HTMLMediaElement, VolumeChannel>();
const contextChannels = new WeakMap<BaseAudioContext, VolumeChannel>();
const routedMedia = new WeakSet<HTMLMediaElement>();

const channelGain = (channel: VolumeChannel | undefined) => volumes.master * (channel ? volumes[channel] : 1);

const mediaChannel = (element: HTMLMediaElement): VolumeChannel | undefined =>
    mediaChannels.get(element) ?? (element.dataset.volumeChannel as VolumeChannel | undefined);

const volumeDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
const baseVolumes = new WeakMap<HTMLMediaElement, number>();
const playing = new Set<HTMLMediaElement>();

const applyMedia = (element: HTMLMediaElement) => {
    const base = baseVolumes.get(element) ?? 1;
    const gain = routedMedia.has(element) ? 1 : channelGain(mediaChannel(element));

    volumeDescriptor.set.call(element, clamp(base * gain));
};

const release = (event: Event) => {
    playing.delete(event.target as HTMLMediaElement);
};

Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
    configurable: true,
    enumerable: volumeDescriptor.enumerable,
    get(this: HTMLMediaElement) {
        return baseVolumes.get(this) ?? volumeDescriptor.get.call(this);
    },
    set(this: HTMLMediaElement, value: number) {
        baseVolumes.set(this, value);
        applyMedia(this);
    },
});

const play = HTMLMediaElement.prototype.play;

HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
    if (!playing.has(this)) {
        playing.add(this);
        this.addEventListener('pause', release, { once: true });
        this.addEventListener('ended', release, { once: true });
    }

    applyMedia(this);

    return play.call(this);
};

const createMediaElementSource = AudioContext.prototype.createMediaElementSource;

AudioContext.prototype.createMediaElementSource = function (this: AudioContext, element: HTMLMediaElement) {
    routedMedia.add(element);
    applyMedia(element);

    return createMediaElementSource.call(this, element);
};

const destinationDescriptor = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'destination');
const contextGains = new Map<AudioContext, GainNode>();

Object.defineProperty(BaseAudioContext.prototype, 'destination', {
    configurable: true,
    enumerable: destinationDescriptor.enumerable,
    get(this: BaseAudioContext) {
        const destination = destinationDescriptor.get.call(this) as AudioDestinationNode;

        if (!(this instanceof AudioContext)) {
            return destination;
        }

        let gain = contextGains.get(this);

        if (!gain) {
            gain = this.createGain();
            gain.gain.value = channelGain(contextChannels.get(this));
            gain.connect(destination);
            contextGains.set(this, gain);
        }

        return gain;
    },
});

const applyAll = () => {
    playing.forEach(applyMedia);
    document.querySelectorAll<HTMLMediaElement>('audio, video').forEach(applyMedia);

    contextGains.forEach((gain, context) => {
        if (context.state === 'closed') {
            contextGains.delete(context);
        } else {
            gain.gain.value = channelGain(contextChannels.get(context));
        }
    });

    Howler.volume(volumes.phone);
};

export const tagMedia = (element: HTMLMediaElement, channel: VolumeChannel) => {
    mediaChannels.set(element, channel);
    applyMedia(element);
};

export const tagContext = (context: AudioContext, channel: VolumeChannel) => {
    contextChannels.set(context, channel);
    applyAll();
};

export const setVolumes = (next: Partial<InterfaceVolumes>) => {
    for (const [channel, value] of Object.entries(next)) {
        volumes[channel as keyof InterfaceVolumes] = clamp(Number(value));
    }

    applyAll();
};

window.addEventListener('message', event => {
    if (event.data?.app === 'global' && event.data?.method === 'Volumes') {
        setVolumes(event.data.data);
    }
});
