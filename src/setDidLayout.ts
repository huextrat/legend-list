import { checkAtBottom } from "./checkAtBottom";
import { type StateContext, set$ } from "./state";
import type { InternalState } from "./types";

export function setDidLayout(ctx: StateContext, state: InternalState) {
    const {
        loadStartTime,
        props: { onLoad },
    } = state;
    state.queuedInitialLayout = true;
    checkAtBottom(ctx, state);

    set$(ctx, "containersDidLayout", true);

    if (onLoad) {
        onLoad({ elapsedTimeInMs: Date.now() - loadStartTime });
    }
}
