import { Platform } from "react-native";

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

    const setIt = () => {
        set$(ctx, "containersDidLayout", true);

        if (onLoad) {
            onLoad({ elapsedTimeInMs: Date.now() - loadStartTime });
        }
    };

    if (Platform.OS === "android") {
        // TODO: This seems to be not 100% accurate on Android
        if (initialScroll) {
            queueMicrotask(() => {
                scrollToIndex(ctx, state, { ...initialScroll, animated: false });
                requestAnimationFrame(() => {
                    // Android sometimes doesn't scroll to the initial index correctly
                    scrollToIndex(ctx, state, { ...initialScroll, animated: false });

                    setIt();
                });
            });
        } else {
            queueMicrotask(setIt);
        }
    } else {
        setIt();
    }
}
