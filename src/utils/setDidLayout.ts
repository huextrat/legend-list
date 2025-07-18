import { IsNewArchitecture } from "@/constants";
import { scrollToIndex } from "@/core/scrollToIndex";
import { type StateContext, set$ } from "@/state/state";
import type { InternalState } from "@/types";
import { checkAtBottom } from "@/utils/checkAtBottom";

export function setDidLayout(ctx: StateContext, state: InternalState) {
    const {
        loadStartTime,
        initialScroll,
        props: { onLoad },
    } = state;
    state.queuedInitialLayout = true;
    checkAtBottom(ctx, state);

    if (!IsNewArchitecture && initialScroll) {
        scrollToIndex(ctx, state, { ...initialScroll, animated: false });
    }

    set$(ctx, "containersDidLayout", true);

    if (onLoad) {
        onLoad({ elapsedTimeInMs: Date.now() - loadStartTime });
    }
}
