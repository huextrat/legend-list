import { Platform } from "react-native";

import { IsNewArchitecture } from "@/constants";
import { getEffectiveScroll } from "@/core/getEffectiveScroll";
import { scrollTo } from "@/core/scrollTo";
import { peek$, type StateContext } from "@/state/state";
import type { InternalState } from "@/types";
import { getId } from "@/utils/getId";
import { requestAdjust } from "@/utils/requestAdjust";

function getItemsInView(ctx: StateContext, state: InternalState) {
    const { startNoBuffer, endNoBuffer, positions, scrollLength } = state;
    const idsInViewWithPositions: { id: string; position: number }[] = [];
    const scroll = getEffectiveScroll(ctx, state);
    if (startNoBuffer !== null && endNoBuffer !== null) {
        for (let i = startNoBuffer; i <= endNoBuffer; i++) {
            const id = getId(state, i);
            if (id) {
                const position = positions.get(id);
                if (position === undefined || position > scroll + scrollLength) {
                    break;
                } else if (position >= scroll) {
                    idsInViewWithPositions.push({ id, position });
                }
            }
        }
    }

    return idsInViewWithPositions;
}

export function prepareMVCP(ctx: StateContext, state: InternalState, dataChanged?: boolean): () => void {
    const {
        positions,
        scrollingTo,
        props: { maintainVisibleContentPosition },
    } = state;

    let prevPosition: number;
    let targetId: string | undefined;
    let idsInViewWithPositions: { id: string; position: number }[] | undefined;
    const scrollTarget = scrollingTo?.index;

    if (maintainVisibleContentPosition) {
        const indexByKey = state.indexByKey;

        if (scrollTarget !== undefined) {
            // If we're currently scrolling to a target index, do MVCP for its position
            console.log("scrollTarget", scrollTarget);
            targetId = getId(state, scrollTarget);
        } else if (peek$(ctx, "containersDidLayout")) {
            idsInViewWithPositions = getItemsInView(ctx, state);
            if (!dataChanged) {
                // Do MVCP for the first item fully in view
                targetId = idsInViewWithPositions.find(({ id }) => indexByKey.get(id) !== undefined)?.id;
                console.log("targetId in view", targetId);
            }
        }

        if (targetId !== undefined) {
            prevPosition = positions.get(targetId)!;
        }
    }

    // Return a function to do MVCP based on the prepared values
    return () => {
        let positionDiff: number | undefined;

        // If data changed then we need to find the first item fully in view
        // which was exists in the new data
        if (dataChanged && idsInViewWithPositions && targetId === undefined) {
            for (let i = 0; i < idsInViewWithPositions.length; i++) {
                const { id, position } = idsInViewWithPositions[i];
                const newPosition = positions.get(id);
                if (newPosition !== undefined) {
                    positionDiff = newPosition - position;
                    console.log("positionDiff", positionDiff, id);
                    break;
                }
            }
        }

        // If we have a targetId, then we can use the previous position of that item
        if (targetId !== undefined && prevPosition !== undefined) {
            const newPosition = positions.get(targetId);

            if (newPosition !== undefined) {
                positionDiff = newPosition - prevPosition;
                console.log("positionDiff targetId", positionDiff, targetId);
            }
        }

        if (positionDiff !== undefined && Math.abs(positionDiff) > 0.1) {
            if (Platform.OS === "android" && !IsNewArchitecture && dataChanged && state.scroll <= positionDiff) {
                scrollTo(state, {
                    offset: state.scroll + positionDiff,
                });
            } else {
                requestAdjust(ctx, state, positionDiff);
            }
        }
    };
}
