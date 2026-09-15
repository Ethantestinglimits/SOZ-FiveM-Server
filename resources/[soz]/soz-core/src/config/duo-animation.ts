import { DuoAnimationConfigList } from '../shared/duo-animation';

export const DuoAnimations: DuoAnimationConfigList = [
    {
        type: 'category',
        name: 'Affection',
        items: [
            {
                type: 'animation',
                animation: {
                    id: 'kiss',
                    label: 'Bisou',
                    distance: 0.5,
                    initiator: { dictionary: 'hs3_ext-20', name: 'cs_lestercrest_3_dual-20' },
                    target: { dictionary: 'hs3_ext-20', name: 'csb_georginacheng_dual-20' },
                },
            },
            {
                type: 'animation',
                animation: {
                    id: 'hug',
                    label: 'Câlin',
                    distance: 1,
                    initiator: { dictionary: 'mp_ped_interaction', name: 'kisses_guy_a' },
                    target: { dictionary: 'mp_ped_interaction', name: 'kisses_guy_b' },
                },
            },
            {
                type: 'animation',
                animation: {
                    id: 'hug_romantic',
                    label: 'Câlin romantique',
                    distance: 0.6,
                    initiator: { dictionary: 'misscarsteal2chad_goodbye', name: 'chad_armsaround_chad' },
                    target: { dictionary: 'misscarsteal2chad_goodbye', name: 'chad_armsaround_girl' },
                },
            },
        ],
    },
    {
        type: 'category',
        name: 'Interactions criminelles',
        items: [
            {
                type: 'animation',
                animation: {
                    id: 'headbutt',
                    label: 'Coup de tête',
                    distance: 1.2,
                    initiator: { dictionary: 'melee@unarmed@streamed_variations', name: 'plyr_takedown_front_headbutt' },
                    target: { dictionary: 'melee@unarmed@streamed_variations', name: 'victim_takedown_front_headbutt' },
                },
            },
            {
                type: 'animation',
                animation: {
                    id: 'punch',
                    label: 'Coup de poing',
                    distance: 1.2,
                    initiator: { dictionary: 'melee@unarmed@streamed_variations', name: 'plyr_takedown_rear_lefthook' },
                    target: { dictionary: 'melee@unarmed@streamed_variations', name: 'victim_takedown_front_cross_r' },
                },
            },
        ],
    },
    {
        type: 'category',
        name: 'Salutations',
        items: [
            {
                type: 'animation',
                animation: {
                    id: 'bro_hug',
                    label: 'Accolade',
                    distance: 1.2,
                    initiator: { dictionary: 'mp_ped_interaction', name: 'hugs_guy_a' },
                    target: { dictionary: 'mp_ped_interaction', name: 'hugs_guy_b' },
                },
            },
            {
                type: 'animation',
                animation: {
                    id: 'handshake',
                    label: 'Poignée de main',
                    distance: 1.2,
                    initiator: { dictionary: 'mp_ped_interaction', name: 'handshake_guy_a' },
                    target: { dictionary: 'mp_ped_interaction', name: 'handshake_guy_b' },
                },
            },
        ],
    },
];
