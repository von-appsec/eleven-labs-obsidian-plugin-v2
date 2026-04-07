import { RangeSet, StateEffect, StateField, Transaction } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";

export interface TTSRange {
    from: number;
    to: number;
}

/**
 * Dispatch with a { from, to } value to set the highlight.
 * Dispatch with null to clear it.
 */
export const setTTSHighlight = StateEffect.define<TTSRange | null>();

const ttsMarkDecoration = Decoration.mark({ class: "tts-highlight" });

export const ttsHighlightField = StateField.define<DecorationSet>({
    create() {
        return Decoration.none;
    },
    update(decorations: DecorationSet, tr: Transaction) {
        decorations = decorations.map(tr.changes);
        for (const effect of tr.effects) {
            if (effect.is(setTTSHighlight)) {
                if (effect.value === null) {
                    decorations = Decoration.none;
                } else {
                    const { from, to } = effect.value;
                    decorations = RangeSet.of([ttsMarkDecoration.range(from, to)]);
                }
            }
        }
        return decorations;
    },
    provide(field: StateField<DecorationSet>) {
        return EditorView.decorations.from(field);
    },
});
