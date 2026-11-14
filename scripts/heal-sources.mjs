// Every healing effect in src/data/game.json (abilities and Relics), hand-extracted.
// Shape: see the task spec. `amount` is a fraction for percentages, HP for 'flat'.
// For basis 'mult' the amount is the % increase (0.5 = +50%); 0 means "unquantified, see note".
// Reviewed 2026-11-14: Blood Siphon (only below 50% HP, a transfer) and Hardtack (only below 30% HP) set to 'other'
// (not timed); Blood Pump donates CURRENT HP, which drains at 10%/s, so averaged at ~40% of Max (10% → 0.04), and it is
// a transfer (`transfer: true`: his own HP, counted at half by grades.mjs); Bone Broth heals 2 more Dudes for 30% each
// of the donation, which is new HP (`addsHealing: true`, +60% at full value); Organ Donor List doubles the donation (+100%); Pizza Party heals from Micromanage's damage only (dps basis
// per Micromanage, not all damage).
export const HEAL_SOURCES = [
  // ---------- Abilities ----------
  { owner: 'chef', source: 'Burger', to: 'team', basis: 'atk', amount: 0.7, targets: 1, trigger: 'on_attack', chance: 1,
    quote: 'When he deals Direct Damage, he prepares a Burger that Heals for 70% of his Attack Power. He can have 4 Burgers prepared at a time, and he delivers them to Roster Dudes as needed.',
    note: 'One Burger prepared per Direct Damage hit (max 4 stored); delivered as needed.' },
  { owner: 'cleric', source: 'Divine Pulse', to: 'team', basis: 'dps', amount: 1, targets: 1, trigger: 'periodic', period: 2, chance: 1,
    quote: "Every 2 seconds, the Cleric Dude creates a Pulse at the most-injured Roster Dude. The Pulse Heals injured Dudes within its radius for 100% of the Cleric Dude's DPS, split evenly among them.",
    note: 'Total is fixed and split among injured Dudes in radius.' },
  { owner: 'explorer', source: 'Canteen', to: 'team', basis: 'dps', amount: 1.5, targets: 1, trigger: 'other', chance: 1,
    quote: 'When a Roster Dude takes damage below 30% HP, the Explorer Dude gives him a Sip from his Canteen to Heal him for 150% of his DPS. His Canteen can hold 2 sips and refills one sip every 3 seconds.',
    note: 'Trigger is a Roster Dude dropping below 30% HP; max 2 stored sips, refill 1 per 3s (about 1 sip / 3s sustained).' },
  { owner: 'farmer', source: '"I\'m Fine"', to: 'team', basis: 'mult', amount: 0.5, targets: 1, trigger: 'other', chance: 1, multiplies: 'any Healing the Farmer receives',
    quote: 'When he receives Healing from another Dude, he Donates 50% of the restored HP to the most-injured other Roster Dude instead of accepting it for himself.',
    note: 'Redirects 50% of Healing the Farmer receives to the most-injured other Dude; no new amount.' },
  { owner: 'frankendude', source: 'Blood Pump', to: 'team', basis: 'own_maxhp', amount: 0.04, targets: 1, trigger: 'periodic', period: 1, chance: 1, transfer: true,
    quote: 'Every second, he Donates 10% of his current HP to the 2 most-injured Roster Dudes, split between them.',
    note: 'Basis is 10% of his CURRENT HP (not Max HP); total split between 2 Dudes. It costs him HP.' },
  { owner: 'ghost', source: 'Phase Shift', to: 'team', basis: 'atk', amount: 1, targets: 2, trigger: 'on_attack', chance: 0.3,
    quote: 'When he deals Direct Damage, he has a 30% chance to Equalize the HP between the most-injured Roster Dude and the healthiest Roster Dude. He then Heals them both for 100% of his Attack Power.',
    note: 'Also Equalizes HP between the two first. Heals both targets (healthiest one may be himself or anyone).' },
  { owner: 'lich', source: 'Enthrall', to: 'team', basis: 'target_maxhp', amount: 0.5, targets: 1, trigger: 'other', chance: 1,
    quote: 'Every 3 seconds, the Stored Damage is Expelled onto them as True Damage. If it is Fatal, the Thrall is Healed for 50% HP and gains a stack of Revenant.',
    note: 'UNSURE: heals a Thrall whose Fatal Expel would kill it (revive-like); every 3s check. Thralls are not necessarily Roster Dudes.' },
  { owner: 'medic', source: 'Triage', to: 'team', basis: 'flat', amount: 10, targets: 2, trigger: 'damage_total', per: 30, chance: 1,
    quote: 'The Medic Dude Heals the 2 most-injured Roster Dudes for 10 every time he deals a total of 30 damage.' },
  { owner: 'mutant', source: 'Floofballs', to: 'team', basis: 'atk', amount: 1, targets: 1, trigger: 'on_attack', chance: 0.5,
    quote: 'His Direct Damage has a 50% chance to create a Floofball that Heals for 100% of his Attack Power. He attaches it to a Roster Dude in danger, and it bursts as needed. Dudes can have up to 4 Floofballs.',
    note: 'Heal is delivered when a Floofball bursts (Dude in danger); up to 4 per Dude.' },
  { owner: 'quantum', source: 'Quantum Echo', to: 'team', basis: 'dps', amount: 0.5, targets: 1, trigger: 'periodic', period: 1, chance: 1,
    quote: 'For each of his Echo Dudes, the Quantum Dude Heals the most-injured Roster Dude for 50% of his DPS every second.',
    note: 'Per active Echo Dude (Echo summoned every 5s if none active).' },

  // ---------- Dude Relics ----------
  { owner: 'mummy', source: 'Anubis Statue', to: 'team', basis: 'damage_dealt', amount: 1, targets: 1, trigger: 'other', chance: 0.15,
    quote: 'When Curse of Doom gets applied to an enemy, it has a 15% chance to also Heal the most-injured Roster Dude for 100% of the amount applied.',
    note: 'Basis is the Curse of Doom amount applied (damage-like), not his total damage dealt.' },
  { owner: 'explorer', source: 'Bandage', to: 'team', basis: 'mult', amount: 1, targets: 1, trigger: 'ability', ability: 'Canteen', chance: 1, multiplies: 'Canteen',
    quote: 'When the Explorer Dude uses Canteen, he also uses a bandage to Heal the most-injured Roster Dude for the same amount.',
    note: 'Adds a second Canteen-sized heal on the most-injured Roster Dude (+100% of Canteen output, possibly to a different target).' },
  { owner: 'vampire', source: 'Blood Bag', to: 'team', basis: 'damage_dealt', amount: 0.8, targets: 1, trigger: 'other', chance: 1,
    quote: 'Any Dude who Lifesteals now also Heals the most-injured Roster Dude for 80% of the Lifesteal amount.',
    note: 'Basis is the Lifesteal amount of ANY Dude (about damage dealt x Lifesteal%).' },
  { owner: 'vampire', source: 'Blood Siphon', to: 'self', basis: 'target_maxhp', amount: 0.2, targets: 1, trigger: 'other', chance: 1,
    quote: 'When the Vampire Dude takes damage while below 50% HP, he Siphons 20% HP from a random healthier Roster Dude and applies Bloodsucker Aura to him.',
    note: 'UNSURE: HP transfer from another Dude to the Vampire; "20% HP" likely of the donor\'s HP/Max HP. Net team heal is zero.' },
  { owner: 'frankendude', source: 'Bone Broth', to: 'team', basis: 'mult', amount: 0.6, targets: 2, trigger: 'ability', ability: 'Blood Pump', chance: 1, multiplies: 'Blood Pump', addsHealing: true,
    quote: "The Frankendude's Blood Pump now additionally Heals the next 2 most-injured Roster Dudes for 30% of the HP Donated each.",
    note: 'Adds new healing: 2 extra Dudes each get 30% of the donated amount (not taken from Frankendude).' },
  { owner: 'necromancer', source: 'Calcium Pills', to: 'team', basis: 'own_maxhp', amount: 1, targets: 1, trigger: 'other', chance: 1,
    quote: 'When a Skeledude takes Fatal Damage, he Heals the 5 most-injured Roster Dudes for 100% of his Max HP, split evenly among them.',
    note: "Fires when a Skeledude dies; basis is the Skeledude's Max HP (not the Necrodude's). Total split among 5. Included because it heals others, not a self-revive." },
  { owner: 'farmer', source: 'Coffee Time', to: 'team', basis: 'mult', amount: 2, targets: 1, trigger: 'ability', ability: '"I\'m Fine"', chance: 1, multiplies: '"I\'m Fine"',
    quote: `When the Farmer Dude Donates HP to another Dude through his "I'm Fine" ability, he also Heals that Dude for 200% of the amount Donated.`,
    note: 'Adds a heal of 200% of the donated amount to the recipient (total 3x donated).' },
  { owner: 'cleric', source: 'Divining Rod', to: 'team', basis: 'mult', amount: 0, targets: 1, trigger: 'ability', ability: 'Divine Pulse', chance: 1, multiplies: 'Divine Pulse',
    quote: 'When the Cleric Dude casts Divine Pulse, the Cooldown of his next Divine Pulse is reduced by 5% per Dude it Healed, up to a maximum reduction of 50%.',
    note: 'HOW OFTEN: shortens Divine Pulse interval by 5% per Dude healed, max 50% (2s -> down to 1s).' },
  { owner: 'general', source: 'Frilled Shoulderpads', to: 'team', basis: 'target_maxhp', amount: 0.2, targets: 1, trigger: 'ability', ability: 'Tactical Command', chance: 1,
    quote: "The General Dude's Tactical Command now Heals for 20% of the target Dude's Max HP, and he gains that amount as Temporary Health for himself for 4 seconds. Overhealing on the target Dude converts to Temporary Health.",
    note: 'Tactical Command cooldown is not in the Relic text.' },
  { owner: 'cleric', source: 'Holy Water', to: 'team', basis: 'mult', amount: 0, targets: 1, trigger: 'ability', ability: 'Divine Pulse', chance: 1, multiplies: 'Divine Pulse',
    quote: "In addition, its Healing on each Dude increases based on that Dude's missing HP Percentage.",
    note: 'Amount of the increase not stated (scales with missing HP %).' },
  { owner: 'cleric', source: 'Incense Holder', to: 'team', basis: 'mult', amount: 0.05, targets: 1, trigger: 'ability', ability: 'Divine Pulse', chance: 1, multiplies: 'Divine Pulse',
    quote: 'The Cleric Dude gains 30% Attack Power, and his Divine Pulse Healing increases by 5% per Dude within its radius.',
    note: '+5% per Dude within the radius.' },
  { owner: 'construction', source: 'Lunch Pail', to: 'self', basis: 'own_maxhp', amount: 1, targets: 1, trigger: 'damage_total', per: 250, chance: 1,
    quote: 'Every time the Construction Dude deals a total of 250 damage, he Heals for 100% of his Max HP.' },
  { owner: 'chef', source: 'Mise en Place', to: 'team', basis: 'mult', amount: 0.5, targets: 1, trigger: 'ability', ability: 'Burger', chance: 1, multiplies: 'Burger',
    quote: 'The Chef Dude starts each battle with maximum Burgers, and his Burgers gain 50% increased Healing.',
    note: 'Also starts the battle with 4 Burgers prepared.' },
  { owner: 'dentist', source: 'Mouthwash', to: 'team', basis: 'atk', amount: 0.5, targets: 1, trigger: 'ability', ability: 'Novocaine Injection', chance: 1,
    quote: 'The Dentist Dude uses Novocaine Injection 5 times when battle starts. Whenever he uses Novocaine Injection, he also Heals the most-injured Roster Dude for 50% of his Attack Power.',
    note: 'Triggers 5 times at battle start plus on every later use.' },
  { owner: 'samurai', source: 'Naginata', to: 'self', basis: 'own_maxhp', amount: 0.5, targets: 1, trigger: 'other', chance: 1,
    quote: 'If the first Direct Damage a Samurai Dude deals after Dashing is a Critical Hit, he Heals for 50% of his Max HP, he instantly uses Swift Pursuit, and he gains a stacking 50% Run Speed for 5 seconds.',
    note: 'Trigger: first Direct Damage after Dashing is a crit.' },
  { owner: 'frankendude', source: 'Organ Donor List', to: 'team', basis: 'mult', amount: 1, targets: 1, trigger: 'ability', ability: 'Blood Pump', chance: 1, multiplies: 'Blood Pump',
    quote: "The Frankendude's Blood Pump now Donates an additional 10% of his HP.",
    note: 'Blood Pump donates 10% -> 20% of his current HP (additive +10 points).' },
  { owner: 'frankendude', source: 'Organ Donor List', to: 'team', basis: 'own_maxhp', amount: 0.5, targets: 1, trigger: 'other', chance: 1,
    quote: 'When a Roster Dude takes Fatal Damage, the healthiest Frankendude with at least 30% HP will Donate 50% of his current HP to save him. 15 second Cooldown.',
    note: 'Basis is 50% of the donor\'s CURRENT HP. A Fatal-Damage save of another Dude via Donation; included because it is a Donate. Cooldown 15s.' },
  { owner: 'manager', source: 'Pizza Party', to: 'both', basis: 'dps', amount: 0.5, targets: 1, trigger: 'ability', ability: 'Micromanage', chance: 1,
    quote: "The Manager Dude's Micromanage now Heals himself and his Interns for 50% of the damage it deals, evenly split among them.",
    note: 'Total fixed, split among himself and his Interns (Interns may not be Roster Dudes).' },
  { owner: 'pirate', source: 'Hardtack', to: 'self', basis: 'own_maxhp', amount: 1, targets: 1, trigger: 'other', chance: 0.3,
    quote: 'When the Pirate Dude takes damage that drops him below 30% HP and survives, he has a 30% chance to fully Heal and gain 20% Evasion for 3 seconds.',
    note: 'Non-fatal, so counted as healing, not Revive. "Fully Heals" = 100% Max HP.' },
  { owner: 'dentist', source: 'Retainer', to: 'team', basis: 'target_maxhp', amount: 0.03, targets: 1, trigger: 'periodic', period: 1, chance: 1,
    quote: "Each stack of Novocaine Injection now also Heals for up to 3% of the Dude's Max HP every second, increasing based on his missing HP Percentage.",
    note: 'Per Novocaine stack on a Dude; 3% is the maximum, scaled by missing HP %. Recipient is the Dude with the stack.' },
  { owner: 'vampire', source: 'Soul Reliquary', to: 'team', basis: 'damage_dealt', amount: 0.15, targets: 1, trigger: 'other', chance: 1,
    quote: 'When the Vampire Dude deals Direct Damage, he marks the target\'s soul for 4 seconds. Any Dude who damages the marked target Heals for 15% of the damage dealt.',
    note: 'Each damaging Dude heals himself for 15% of his own damage to the marked enemy (a Lifesteal-like effect on any Dude).' },
  { owner: 'chef', source: 'Special Sauce', to: 'team', basis: 'mult', amount: 0, targets: 1, trigger: 'ability', ability: 'Burger', chance: 1, multiplies: 'Burger',
    quote: "The Healing from the Chef Dude's Burgers can now Crit. In addition, his Burgers grant 10% Crit Chance for 3 seconds.",
    note: 'Burgers can Crit (Crit multiplier applies); no fixed amount.' },
  { owner: 'cleric', source: 'Thoughts and Prayers', to: 'team', basis: 'mult', amount: 0.1, targets: 1, trigger: 'ability', ability: 'Divine Pulse', chance: 1, multiplies: 'Divine Pulse',
    quote: 'Any Dude Healed by Divine Pulse gains 1% Evasion and receives 10% increased Healing from Divine Pulse for 4 seconds. This stacks up to 10 times.',
    note: '+10% per stack, up to 10 stacks (+100%), per healed Dude, 4s duration.' },
  { owner: 'quantum', source: 'Wave Function', to: 'team', basis: 'mult', amount: 0, targets: 1, trigger: 'ability', ability: 'Quantum Echo', chance: 0.5, multiplies: 'Quantum Echo',
    quote: "The Quantum Dude's Quantum Echo now has a 50% chance to Heal an additional injured Roster Dude. In addition, he casts Quantum Echo for every 50 feet he travels.",
    note: 'WHO/HOW OFTEN: 50% chance for one extra target; extra casts per 50 ft travelled (rate unknown).' },
  { owner: 'coach', source: 'Whiteboard', to: 'team', basis: 'atk', amount: 3, targets: 1, trigger: 'ability', ability: 'Walk It Off', chance: 1,
    quote: 'After using Walk It Off, the Coach Dude then Heals the most-injured Roster Dude for 300% of his Attack Power.' },
  { owner: 'mutant', source: 'Zinc Finger', to: 'team', basis: 'mult', amount: 0.3, targets: 1, trigger: 'ability', ability: 'Floofballs', chance: 0.3, multiplies: 'Floofballs',
    quote: 'When a Floofball bursts, it has a 30% chance to immediately regrow and gain a stacking 30% increased Healing the next time it bursts.',
    note: 'Stacks: +30% per regrow; also adds extra bursts (regrow chance 30%).' },

  // ---------- Family Relics ----------
  { owner: 'family:sports', source: 'Halftime Show', to: 'team', basis: 'target_maxhp', amount: 0.3, targets: 3, trigger: 'periodic', period: 10, chance: 1,
    quote: 'Every 10 seconds, all Dudes Heal for 30% of their Max HP. Any Overhealing from this effect is converted to Temporary Health that lasts for 3 seconds.',
    note: 'All Dudes (each Dude heals 30% of its own Max HP).' },
  { owner: 'family:undead', source: 'Sewing Kit', to: 'self', basis: 'damage_taken', amount: 1, targets: 1, trigger: 'on_hit_taken', chance: 0.15,
    quote: 'All Dudes have a 15% chance when taking damage to Heal for 100% of the damage taken if the damage was not Fatal.',
    note: 'Each Dude heals itself.' },

  // ---------- Global Relics ----------
  { owner: 'group:universal', source: 'Half-Full Glass', to: 'self', basis: 'target_maxhp', amount: 0.15, targets: 1, trigger: 'on_hit_taken', chance: 1,
    quote: 'When a Dude takes damage that brings his HP below 50%, he Heals for 15% of his Max HP. 5 second Cooldown.',
    note: 'Per Dude, 5s cooldown.' },
  { owner: 'group:universal', source: 'Ice Bath', to: 'self', basis: 'target_maxhp', amount: 0.2, targets: 1, trigger: 'other', chance: 0.1,
    quote: 'All Dudes gain 2% Regeneration. When a Dude Heals through Regeneration, he has a 10% chance to Heal for an additional 20% of his Max HP.',
    note: 'Needs a Regeneration tick (the 2% Regeneration is excluded as a stat). Each Dude heals itself.' },
  { owner: 'group:universal', source: 'Living Will', to: 'team', basis: 'flat', amount: 20, targets: 10, trigger: 'other', chance: 1,
    quote: 'When any Dude gets Knocked Out, the 10 most-injured Roster Dudes are Healed for 20.',
    note: 'Fires on each Knock Out.' },
  { owner: 'group:universal', source: 'Pumpkin Latte', to: 'team', basis: 'mult', amount: 0, targets: 3, trigger: 'other', chance: 1, multiplies: 'Health Potions',
    quote: 'Immediately grants 2 Health Potions and reduces their price by 50%. Health Potions now Heal all of your Roster Dudes and grant 20% Toughness for 5 seconds.',
    note: 'WHO: Health Potions (a shop item, amount not in data) now heal ALL Roster Dudes; grants 2 potions.' },
];

// Excluded (mentions healing, but not a healing source under the rules):
// Ablative Shield: Temporary Health from Healing received
// Antifragility Implant: Temporary Health
// Barrel of Oranges: Healing Received %
// Beam Splitter: Temporary Health
// Bear Back: Temporary Health
// Bear Down: Fatal-Damage save (revive)
// Bite Stick: Fatal-Damage save for another Dude (revive)
// Bloody Talisman: Attack Speed from receiving Healing
// Blacksmith's Hammer: damage from Temporary Health
// Book of Life: Healing Received %, Fatal-Damage self-heal (revive)
// Brain in a Jar: damage when Donating (no heal change)
// Bulletproof Suit: Fatal-Damage save for another Dude (revive)
// Chestplate: Temporary Health
// Clerical Error: converts Healing to damage
// Dental Filling: Temporary Health
// Deflated Ball: revive
// Dissection Kit: Fatal-Damage save (revive)
// Duality: Deflection from Healing (no heal change)
// Ectoplasm Vial: Temporary Health
// Electrolytes: Temporary Health
// Enchanted Girdle: Temporary Health on Fatal Damage
// Everburning Torch: Temporary Health
// Exfiltrate.exe: Temporary Health
// Expired Skin Cream: damage from Healing received
// Fairy Ring: Healing Received %
// Fountain of Youth: Fatal-Damage save (revive)
// Great Helm: Temporary Health
// Growth Hormone: Healing Received %, Regeneration
// Hard Hat: Temporary Health on Fatal Damage
// Headset: Regeneration and Temporary Health
// Holy Symbol: Fatal-Damage save (revive) with a boosted Divine Pulse
// Ibuprofen: Temporary Health
// Jaw Implant: Fatal-Damage save (eats a Dude)
// Laughing Gas: damage postponement
// Liquid Metal: Fatal-Damage save (revive)
// Loose Tooth: Healing Received %
// Mana Collector: Temporary Health
// Marrow Scooper: Fatal-Damage save (revive)
// Medallion of Vengeance: Fatal-Damage save (revive)
// Memento Mori: Healing Received %
// Metronome: Temporary Health
// Milkshake: Temporary Health
// Morphine: Temporary Health from Triage heal
// OH DANG! Button: Temporary Health on Fatal Damage
// Old Jacket: Healing Received %
// Padded Helmet: Temporary Health
// Pocket Flask: Fatal-Damage save (revive)
// Postmortem: Fatal-Damage save (revive)
// Power Siphon: Temporary Health
// Protective Cloak: Temporary Health
// Purple Heart: Temporary Health
// Quark Nugget: Temporary Health
// Red Card: Fatal-Damage save (revive)
// Rewinder: Fatal-Damage save (revive)
// Ring of Shielding: Overhealing to Temporary Health
// Ritual Dagger: Regeneration plus damage on Regeneration
// Ruby Scepter: Healing Received %
// Runic Tattoo: Temporary Health
// Sarcophagus: Fatal-Damage save (revive)
// Schrodinger's Box: Fatal-Damage save (revive)
// Shadow Skin: Temporary Health from Lifesteal
// Sideline Report: Temporary Health
// Smelling Salts: revive
// Tinderbox: Healing Received %
// Tosei Gusoku: Temporary Health
// Tourniquet: Fatal-Damage save (revive)
// Trucker Hat: Attack Power from Healing received
// Unit Tattoo: Temporary Health
// Valkyrie Amulet: Fatal-Damage save (revive)
// Willing Flesh: Healing Received %, revive
// Wooden Fence: Temporary Health and Donating Temporary Health
// Abilities excluded: GET DOWN! (Temporary Health), Walk It Off (Equalize plus Temporary Health; its extra heal is the Whiteboard Relic),
//   Undead Hunger (taunt when receiving Healing)
