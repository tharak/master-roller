import {
  availableMerges,
  DICE,
  type GameState,
  type MergeRecipe,
} from "./game";
import DieShape from "./DieShape";

export default function MergeShop({
  game,
  rolling,
  onMerge,
}: {
  game: GameState;
  rolling: boolean;
  onMerge: (recipe: MergeRecipe) => void;
}) {
  const recipes = availableMerges(game);
  return (
    <section className="merge-shop" aria-labelledby="merge-heading">
      <h3 id="merge-heading">Merge dice</h3>
      <p>
        Free · two dice become one, freeing a slot. The maximum stays the same;
        average income per roll drops by 0.5.
      </p>
      {recipes.length ? (
        <div className="merge-options">
          {recipes.map((recipe) => (
            <button
              className="merge-option"
              key={recipe.inputs.join("+")}
              aria-label={`Merge ${recipe.inputs[0]} and ${recipe.inputs[1]} into ${recipe.output}`}
              disabled={rolling}
              onClick={() => onMerge(recipe)}
            >
              <span className="merge-equation" aria-hidden="true">
                {[...recipe.inputs, recipe.output].map((id, index) => {
                  const die = DICE.find((die) => die.id === id)!;
                  return (
                    <span className="merge-term" key={index}>
                      {index > 0 && (
                        <span className="merge-symbol">
                          {index === 1 ? "+" : "→"}
                        </span>
                      )}
                      <span className={`merge-die die-${id} ${die.color}`}>
                        <DieShape id={id} />
                        <strong className="die-value">{die.max}</strong>
                      </span>
                    </span>
                  );
                })}
              </span>
              <span className="merge-action">Merge</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="merge-empty">
          No matching pair yet. Two d4s can make a d8, or a d4 and d6 can make a
          d10.
        </p>
      )}
      <p className="merge-note">
        Purchased slots stay yours. Merging clears the previous roll’s faces and
        details.
      </p>
    </section>
  );
}
