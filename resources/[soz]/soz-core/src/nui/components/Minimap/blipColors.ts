const BlipColors: Record<number, string> = {
    0: '#fefefe',
    1: '#e03232',
    2: '#71cb71',
    3: '#5db6e5',
    4: '#fefefe',
    5: '#eec64e',
    6: '#c25050',
    7: '#9c6eaf',
    8: '#fe7ac3',
    9: '#f59d79',
    10: '#b18f83',
    11: '#8dcea7',
    12: '#70a8ae',
    13: '#d3d1e7',
    14: '#8f7e98',
    15: '#6ac4bf',
    16: '#d5c398',
    17: '#ea8e50',
    18: '#97cae9',
    19: '#b26287',
    20: '#8f8d79',
    21: '#a6755e',
    22: '#afa8a8',
    23: '#e88e9b',
    24: '#bbd65b',
    25: '#0c7b56',
    26: '#7ac3fe',
    27: '#ab3ce6',
    28: '#cda80c',
    29: '#4561ab',
    30: '#29a5b8',
    31: '#b89b7b',
    32: '#c8e0fe',
    33: '#f0f096',
    34: '#ed8ca1',
    35: '#f98a8a',
    36: '#fbeea5',
    37: '#fefefe',
    38: '#2c6db8',
    39: '#9a9a9a',
    40: '#4c4c4c',
    41: '#f29d9d',
};

export const UNTINTED_BLIP_COLORS = [0, 4, 37];

export const getBlipColor = (color: number): string => {
    if (color > 255) {
        return `#${(color >>> 8).toString(16).padStart(6, '0')}`;
    }

    return BlipColors[color] ?? BlipColors[0];
};
