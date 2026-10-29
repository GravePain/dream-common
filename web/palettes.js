// The built-in palettes every dream tool shares (Dream Forge's originals). Each fills the same colour roles,
// so any of them works with any generator; palettes saved to the library use this same shape ("<name>.palette.json").
// Tools import this from the library: import { PRESETS } from '<library>/palettes.js'.
export const PRESETS = [
  {
    name: 'Scald', tags: ['desert', 'wasteland', 'rust'],
    roles: { bone: '#e8d9b8', pale: '#e0c79a', sand: '#c9a978', clay: '#8a5a3a', burnt: '#d9773a', rust: '#a8502a', scorch: '#3a2a22', timber: '#7a5c40', metal: '#8c8478', sage: '#8a9474', rot: '#b8c24a' },
    metals: ['#8c8478', '#9a9284', '#7c7a72', '#a89478'],
    tarps: ['#b88a5a', '#7a8a6a', '#9a5a40', '#c0a888', '#5a6a7a', '#8a3a2a'],
    drums: ['#4a5a48', '#8a3a2a', '#5a5a62', '#a8842a'],
    view: { sky: '#cfd8d6', ground: '#c9a978' },
  },
  {
    name: 'Ironwood', tags: ['forest', 'moss', 'damp'],
    roles: { bone: '#d8d2b0', pale: '#a8a27a', sand: '#5e6a3e', clay: '#3e3424', burnt: '#c98a3a', rust: '#7a4a2a', scorch: '#1e1e16', timber: '#5a4630', metal: '#6a7068', sage: '#4e7a3a', rot: '#9ac24a' },
    metals: ['#6a7068', '#5a6460', '#7a7e72', '#4e5a52'],
    tarps: ['#5a6a3a', '#7a5a3a', '#3e4a5a', '#8a7a5a', '#4a3a2a', '#6a2e22'],
    drums: ['#3e4a32', '#5a2e22', '#4a4e52', '#7a6a2a'],
    view: { sky: '#b8c4b0', ground: '#5e6a3e' },
  },
  {
    name: 'Frostbite', tags: ['snow', 'ice', 'cold'],
    roles: { bone: '#f4f6f8', pale: '#d8e2ea', sand: '#c4d2dc', clay: '#7a8a98', burnt: '#e0a060', rust: '#8a5a4a', scorch: '#2a3038', timber: '#6a5a4e', metal: '#9aa6b0', sage: '#6a8a8a', rot: '#8ad8e8' },
    metals: ['#9aa6b0', '#aab4bc', '#7e8a94', '#b4bcc2'],
    tarps: ['#c0ccd6', '#6a7a8a', '#8a4a3a', '#d8d0c0', '#3e5a7a', '#7a2a2a'],
    drums: ['#4a6a7a', '#8a3a2a', '#c0c8ce', '#5a5a62'],
    view: { sky: '#dfe8ee', ground: '#e8eef2' },
  },
  {
    name: 'Ashlands', tags: ['volcanic', 'ash', 'burnt'],
    roles: { bone: '#b8b4ae', pale: '#8e8a84', sand: '#5a5652', clay: '#3a3430', burnt: '#ff7a2a', rust: '#c2401a', scorch: '#141212', timber: '#2e2622', metal: '#5e5e5e', sage: '#5a5a48', rot: '#ffb24a' },
    metals: ['#5e5e5e', '#4a4a4c', '#6e6a66', '#3a3a3c'],
    tarps: ['#4a3e36', '#6a2a1e', '#3a3a3a', '#7a6a5a', '#2a2a30', '#8a2a1a'],
    drums: ['#2e2e2e', '#7a2a1a', '#4a4a50', '#8a6a2a'],
    view: { sky: '#6a6460', ground: '#4a4642' },
  },
  {
    name: 'Neon Wastes', tags: ['cyber', 'neon', 'night'],
    roles: { bone: '#e0e4ff', pale: '#8a8ab0', sand: '#3a3a52', clay: '#24243a', burnt: '#ff3ad0', rust: '#7a2aa8', scorch: '#0e0e18', timber: '#3a2e3e', metal: '#5a6078', sage: '#2ae0c0', rot: '#3affe0' },
    metals: ['#5a6078', '#46506a', '#6e7088', '#3a3e52'],
    tarps: ['#ff3ad0', '#2ae0c0', '#5a3aa8', '#ffd23a', '#2a4aff', '#e02a4a'],
    drums: ['#2a2a3e', '#ff3ad0', '#2ae0c0', '#ffd23a'],
    view: { sky: '#1a1a2e', ground: '#24243a' },
  },
  {
    name: 'Oasis', tags: ['coast', 'stone', 'bright'],
    roles: { bone: '#fbf6ec', pale: '#efe2c8', sand: '#e4cfa0', clay: '#b06a42', burnt: '#e88a3a', rust: '#b04a2a', scorch: '#3a2a22', timber: '#8a6a48', metal: '#9aa0a0', sage: '#3a9a7a', rot: '#4ac8c0' },
    metals: ['#9aa0a0', '#b0b0a8', '#8a908e', '#c0b8a8'],
    tarps: ['#e8e0d0', '#3a9a9a', '#c05a3a', '#e8c070', '#2a6a9a', '#9a2a3a'],
    drums: ['#2a7a8a', '#c04a2a', '#e8e0d0', '#d8a02a'],
    view: { sky: '#cfe8f0', ground: '#e4cfa0' },
  },
];
