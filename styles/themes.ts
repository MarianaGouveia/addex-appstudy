export type ThemeName = "legacy";

export interface Palette {
  firstColor: string;
  secondColor: string;
  thirdColor: string;
  fourthColor: string;
  buttons: string;
  card: string;
  darkblue: string;
  green: string;
  blue: string;
  black: string;
  white: string;
  teal: string;
  gray: string;
  grayDark: string;
  background: string;
  pastel: string[];
  animatedColors: string[];
  headingAccents: string[];
}

export const legacyPalette: Palette = {
  firstColor: "#3366CC",
  secondColor: "#4C5BD4",
  thirdColor: "#66CC33",
  fourthColor: "#57C9C5",
  buttons: "#3366CC",
  card: "#050F28",
  darkblue: "#1E2A47",
  green: "#66CC33",
  blue: "#3366CC",
  black: "#000000",
  white: "#FFFFFF",
  teal: "#57C9C5",
  gray: "#6B7A8F",
  grayDark: "#666666",
  background: "#FFFFFF",
  pastel: [
    "#E8C3D3", "#F6D6AD", "#F9E27D", "#CFE8A9", "#AEE5C8",
    "#BFE9E3", "#A9D6F5", "#C7CEFF", "#D9C2F0", "#F4C7E7",
    "#F7C7B6", "#D6E6B8", "#B8E0D2", "#C9D9F7", "#EAD7B8",
  ],
  animatedColors: [
    "#4C5BD4", "#6F7BE3", "#3A46A8",
    "#3366CC", "#5C85D6", "#1E2A47",
    "#57C9C5", "#8FDCDC", "#3FA3A0",
    "#66CC33", "#85E066", "#4C9926",
  ],
  headingAccents: [
    "#4C5BD4", "#6F7BE3", "#3A46A8",
    "#3366CC", "#5C85D6", "#1E2A47",
    "#57C9C5", "#8FDCDC", "#3FA3A0",
    "#66CC33", "#85E066", "#4C9926",
  ],
};

export const themes: Record<ThemeName, Palette> = {
  legacy: legacyPalette,
};
