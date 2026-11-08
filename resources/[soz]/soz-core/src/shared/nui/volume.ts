export type VolumeChannel = 'effects' | 'music' | 'phone' | 'video';

export type InterfaceVolumes = Record<VolumeChannel | 'master', number>;
