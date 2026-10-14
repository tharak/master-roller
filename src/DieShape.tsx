import type { DieId } from "./game";

export const DIE_SHAPES: Record<DieId, string> = {
  d4: "pyramid",
  d6: "cube",
  d8: "octahedron",
  d10: "trapezohedron",
  d12: "dodecahedron",
  d20: "icosahedron",
  d100: "faceted sphere",
};

export default function DieShape({ id }: { id: DieId }) {
  const geometry = (() => {
    switch (id) {
      case "d4":
        return (
          <>
            <path className="shape-base" d="M50 5 97 83 50 97 3 83Z" />
            <path className="shape-front" d="M50 5 80 86 3 83Z" />
            <path className="shape-light" d="M50 5 97 83 80 86Z" />
            <path className="shape-detail" d="M3 83 80 86 50 97" />
          </>
        );
      case "d6":
        return (
          <>
            <path
              className="shape-base"
              d="M8 25 50 5 93 25 93 77 50 97 8 77Z"
            />
            <path className="shape-front" d="M8 25 59 32 59 89 8 77Z" />
            <path className="shape-light" d="M8 25 50 5 93 25 59 32Z" />
            <path
              className="shape-detail"
              d="M59 32 93 25M59 89 93 77M59 89 50 97"
            />
          </>
        );
      case "d8":
        return (
          <>
            <path className="shape-base" d="M50 3 94 50 50 97 6 50Z" />
            <path className="shape-front" d="M50 3 78 61 6 50Z" />
            <path className="shape-light" d="M50 3 94 50 78 61Z" />
            <path className="shape-detail" d="M6 50 78 61 50 97M78 61 94 50" />
          </>
        );
      case "d10":
        return (
          <>
            <path
              className="shape-base"
              d="M50 3 89 26 98 63 50 97 2 63 11 26Z"
            />
            <path className="shape-front" d="M50 3 74 57 50 97 26 57Z" />
            <path className="shape-light" d="M50 3 89 26 74 57Z" />
            <path
              className="shape-detail"
              d="M11 26 26 57 2 63M26 57 50 97 74 57 98 63M89 26 74 57"
            />
          </>
        );
      case "d12":
        return (
          <>
            <path
              className="shape-base"
              d="M26 7 74 7 98 38 84 82 50 98 16 82 2 38Z"
            />
            <path className="shape-front" d="M50 19 78 39 67 71 33 71 22 39Z" />
            <path className="shape-light" d="M26 7 74 7 50 19 22 39 2 38Z" />
            <path
              className="shape-detail"
              d="M74 7 78 39 98 38M78 39 84 82 67 71M67 71 50 98 33 71M33 71 16 82 22 39"
            />
          </>
        );
      case "d20":
        return (
          <>
            <path
              className="shape-base"
              d="M50 3 92 24 96 73 50 97 4 73 8 24Z"
            />
            <path className="shape-front" d="M50 17 82 72 18 72Z" />
            <path className="shape-light" d="M50 3 92 24 50 17 8 24Z" />
            <path
              className="shape-detail"
              d="M8 24 18 72 4 73M8 24 50 17 92 24 82 72 96 73M18 72 50 97 82 72M18 72 82 72"
            />
          </>
        );
      case "d100":
        return (
          <>
            <circle className="shape-base" cx="50" cy="50" r="47" />
            <path
              className="shape-front"
              d="M34 9 66 9 90 34 90 66 66 91 34 91 10 66 10 34Z"
            />
            <path
              className="shape-detail"
              d="M34 9 22 28 10 34M66 9 78 28 90 34M90 66 78 73 66 91M34 91 22 73 10 66M22 28 50 16 78 28 85 51 78 73 50 84 22 73 15 51Z"
            />
            <path
              className="shape-detail"
              d="M22 28 33 43M78 28 67 43M78 73 67 61M22 73 33 61M50 16 50 30M50 84 50 74"
            />
          </>
        );
    }
  })();
  return (
    <svg
      className={`die-shape shape-${id}`}
      data-die-shape={DIE_SHAPES[id]}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      {geometry}
    </svg>
  );
}
