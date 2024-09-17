// https://stackoverflow.com/questions/3368837/list-every-font-a-users-browser-can-display
export const FontDetector = function () {
  // a font will be compared against all the three default fonts.
  // and if it doesn't match all 3 then that font is not available.
  const baseFonts = ["monospace", "sans-serif", "serif"];

  //we use m or w because these two characters take up the maximum width.
  // And we use a LLi so that the same matching fonts can get separated
  const testString = "mmmmmmmmmmlli";

  //we test using 72px font size, we may use any size. I guess larger the better.
  const testSize = "72px";

  const h = document.getElementsByTagName("body")[0];

  // create a SPAN in the document to get the width of the text we use to test
  const s = document.createElement("span");
  s.style.fontSize = testSize;
  s.innerHTML = testString;
  const defaultWidth: Record<string, number> = {};
  const defaultHeight: Record<string, number> = {};
  for (const index in baseFonts) {
    //get the default width for the three base fonts
    s.style.fontFamily = baseFonts[index];
    h.appendChild(s);
    defaultWidth[baseFonts[index]] = s.offsetWidth; //width for the default font
    defaultHeight[baseFonts[index]] = s.offsetHeight; //height for the defualt font
    h.removeChild(s);
  }

  function detect(font: string) {
    let detected = false;
    for (const index in baseFonts) {
      s.style.fontFamily = font + "," + baseFonts[index]; // name of the font along with the base font for fallback.
      h.appendChild(s);
      const matched =
        s.offsetWidth != defaultWidth[baseFonts[index]] ||
        s.offsetHeight != defaultHeight[baseFonts[index]];
      h.removeChild(s);
      detected = detected || matched;
    }
    return detected;
  }

  return { detect };
};

const allPossibleFonts = [
  "Arial",
  "Arial Black",
  "Bahnschrift",
  "Calibri",
  "Cambria",
  "Cambria Math",
  "Candara",
  "Comic Sans MS",
  "Consolas",
  "SF Mono",
  "Constantia",
  "Corbel",
  "Courier New",
  "Ebrima",
  "Franklin Gothic Medium",
  "Gabriola",
  "Gadugi",
  "Georgia",
  "HoloLens MDL2 Assets",
  "Impact",
  "Ink Free",
  "Inter",
  "IBM Plex Mono",
  "Javanese Text",
  "Leelawadee UI",
  "Lucida Console",
  "Lucida Sans Unicode",
  "Malgun Gothic",
  "Marlett",
  "Microsoft Himalaya",
  "Microsoft JhengHei",
  "Microsoft New Tai Lue",
  "Microsoft PhagsPa",
  "Microsoft Sans Serif",
  "Microsoft Tai Le",
  "Microsoft YaHei",
  "Microsoft Yi Baiti",
  "MingLiU-ExtB",
  "Mongolian Baiti",
  "MS Gothic",
  "MV Boli",
  "Myanmar Text",
  "Nirmala UI",
  "Palatino Linotype",
  "Segoe MDL2 Assets",
  "Segoe Print",
  "Segoe Script",
  "Segoe UI",
  "Segoe UI Historic",
  "Segoe UI Emoji",
  "Segoe UI Symbol",
  "SimSun",
  "Sitka",
  "Sylfaen",
  "Symbol",
  "Tahoma",
  "Roboto",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
  "Webdings",
  "Wingdings",
  "Yu Gothic",
  "American Typewriter",
  "Andale Mono",
  "Arial Narrow",
  "Arial Rounded MT Bold",
  "Arial Unicode MS",
  "Avenir",
  "Avenir Next",
  "Avenir Next Condensed",
  "Baskerville",
  "Big Caslon",
  "Bodoni 72",
  "Bodoni 72 Oldstyle",
  "Bodoni 72 Smallcaps",
  "Bradley Hand",
  "Brush Script MT",
  "Chalkboard",
  "Chalkboard SE",
  "Chalkduster",
  "Charter",
  "Cochin",
  "Copperplate",
  "Courier",
  "Didot",
  "DIN Alternate",
  "DIN Condensed",
  "Futura",
  "Geneva",
  "Gill Sans",
  "IBM Plex Sans",
  "Noto Sans",
  "Noto Sans CJK SC",
  "Source Han Sans SC",
  "Helvetica",
  "Helvetica Neue",
  "Herculanum",
  "Hoefler Text",
  "Lucida Grande",
  "Luminari",
  "Marker Felt",
  "Menlo",
  "Monaco",
  "Noteworthy",
  "Optima",
  "Palatino",
  "Papyrus",
  "Phosphate",
  "Rockwell",
  "Savoye LET",
  "SignPainter",
  "Skia",
  "Snell Roundhand",
  "Times",
  "Trattatello",
  "Zapfino",
];

let availableFonts: string[] | null = null;
export const listAvailableFonts = (ignoreCache: boolean = false) => {
  if (!ignoreCache && availableFonts != null) return availableFonts;

  availableFonts = [];
  const detector = FontDetector();
  for (const font of allPossibleFonts) {
    if (detector.detect(font)) availableFonts.push(font);
  }

  return availableFonts;
};
