import { calculateOffsetForIndex } from "./calculateOffsetForIndex";
import { calculateOffsetWithOffsetPosition } from "./calculateOffsetWithOffsetPosition";
import { checkAllSizesKnown } from "./checkAllSizesKnown";
import { ENABLE_DEBUG_VIEW, POSITION_OUT_OF_VIEW } from "./constants";
import { findAvailableContainers } from "./findAvailableContainers";
import { getId } from "./getId";
import { getItemSize } from "./getItemSize";
import { getScrollVelocity } from "./getScrollVelocity";
import { prepareMVCP } from "./prepareMVCP";
import { setDidLayout } from "./setDidLayout";
import { type StateContext, peek$, set$ } from "./state";
import type { InternalState } from "./types";
import { updateAllPositions } from "./updateAllPositions";
import { updateViewableItems } from "./viewability";

export function calculateItemsInView(
    ctx: StateContext,
    state: InternalState,
    params: { doMVCP?: boolean; dataChanged?: boolean } = {},
) {
    const {
        scrollLength,
        startBufferedId: startBufferedIdOrig,
        positions,
        columns,
        containerItemKeys,
        idCache,
        sizes,
        indexByKey,
        scrollForNextCalculateItemsInView,
        enableScrollForNextCalculateItemsInView,
        minIndexSizeChanged,
    } = state;
    const data = state.props.data;
    if (!data || scrollLength === 0) {
        return;
    }

    const totalSize = peek$(ctx, "totalSize");
    const topPad = peek$(ctx, "stylePaddingTop") + peek$(ctx, "headerSize");
    const numColumns = peek$(ctx, "numColumns");
    const previousScrollAdjust = 0;
    const { dataChanged, doMVCP } = params;
    const speed = getScrollVelocity(state);

    if (doMVCP || dataChanged) {
        // TODO: This should only run if a size changed or items changed
        // Handle maintainVisibleContentPosition adjustment early
        const checkMVCP = doMVCP ? prepareMVCP(ctx, state) : undefined;

        // Update all positions upfront so we can assume they're correct
        updateAllPositions(ctx, state, dataChanged);

        checkMVCP?.();
    }

    const scrollExtra = 0;
    // Disabled this optimization for now because it was causing blanks to appear sometimes
    // We may need to control speed calculation better, or not have a 5 item history to avoid this issue
    // const scrollExtra = Math.max(-16, Math.min(16, speed)) * 24;

    const { queuedInitialLayout } = state;
    let { scroll: scrollState } = state;

    // If this is before the initial layout, and we have an initialScrollIndex,
    // then ignore the actual scroll which might be shifting due to scrollAdjustHandler
    // and use the calculated offset of the initialScrollIndex instead.
    const initialScroll = state.props.initialScroll;
    if (!queuedInitialLayout && initialScroll) {
        const updatedOffset = calculateOffsetWithOffsetPosition(
            state,
            calculateOffsetForIndex(ctx, state, initialScroll.index),
            initialScroll,
        );
        scrollState = updatedOffset;
    }

    const scrollAdjustPad = -previousScrollAdjust - topPad;
    let scroll = scrollState + scrollExtra + scrollAdjustPad;

    // Sometimes we may have scrolled past the visible area which can make items at the top of the
    // screen not render. So make sure we clamp scroll to the end.
    if (scroll + scrollLength > totalSize) {
        scroll = totalSize - scrollLength;
    }

    if (ENABLE_DEBUG_VIEW) {
        set$(ctx, "debugRawScroll", scrollState);
        set$(ctx, "debugComputedScroll", scroll);
    }

    const scrollBuffer = state.props.scrollBuffer;
    let scrollBufferTop = scrollBuffer;
    let scrollBufferBottom = scrollBuffer;

    if (speed > 0) {
        scrollBufferTop = scrollBuffer * 0.5;
        scrollBufferBottom = scrollBuffer * 1.5;
    } else {
        scrollBufferTop = scrollBuffer * 1.5;
        scrollBufferBottom = scrollBuffer * 0.5;
    }

    const scrollTopBuffered = scroll - scrollBufferTop;
    const scrollBottom = scroll + scrollLength;
    const scrollBottomBuffered = scrollBottom + scrollBufferBottom;

    // Check precomputed scroll range to see if we can skip this check
    if (scrollForNextCalculateItemsInView) {
        const { top, bottom } = scrollForNextCalculateItemsInView;
        if (scrollTopBuffered > top && scrollBottomBuffered < bottom) {
            return;
        }
    }

    let startNoBuffer: number | null = null;
    let startBuffered: number | null = null;
    let startBufferedId: string | null = null;
    let endNoBuffer: number | null = null;
    let endBuffered: number | null = null;

    let loopStart: number = startBufferedIdOrig ? indexByKey.get(startBufferedIdOrig) || 0 : 0;

    if (minIndexSizeChanged !== undefined) {
        loopStart = Math.min(minIndexSizeChanged, loopStart);
        state.minIndexSizeChanged = undefined;
    }

    // Go backwards from the last start position to find the first item that is in view
    // This is an optimization to avoid looping through all items, which could slow down
    // when scrolling at the end of a long list.
    for (let i = loopStart; i >= 0; i--) {
        const id = idCache.get(i) ?? getId(state, i)!;
        const top = positions.get(id)!;
        const size = sizes.get(id) ?? getItemSize(state, id, i, data[i]);
        const bottom = top + size;

        if (bottom > scroll - scrollBuffer) {
            loopStart = i;
        } else {
            break;
        }
    }

    const loopStartMod = loopStart % numColumns;
    if (loopStartMod > 0) {
        loopStart -= loopStartMod;
    }

    let foundEnd = false;
    let nextTop: number | undefined;
    let nextBottom: number | undefined;

    // TODO PERF: Could cache this while looping through numContainers at the end of this function
    // This takes 0.03 ms in an example in the ios simulator
    const prevNumContainers = ctx.values.get("numContainers") as number;
    let maxIndexRendered = 0;
    for (let i = 0; i < prevNumContainers; i++) {
        const key = peek$(ctx, `containerItemKey${i}`);
        if (key !== undefined) {
            const index = indexByKey.get(key)!;
            maxIndexRendered = Math.max(maxIndexRendered, index);
        }
    }

    let firstFullyOnScreenIndex: number | undefined;

    // scan data forwards
    // Continue until we've found the end and we've updated positions of all items that were previously in view
    const dataLength = data!.length;
    for (let i = Math.max(0, loopStart); i < dataLength && (!foundEnd || i <= maxIndexRendered); i++) {
        const id = idCache.get(i) ?? getId(state, i)!;
        const size = sizes.get(id) ?? getItemSize(state, id, i, data[i]);
        const top = positions.get(id)!;

        if (!foundEnd) {
            if (startNoBuffer === null && top + size > scroll) {
                startNoBuffer = i;
            }
            // Subtract 10px for a little buffer so it can be slightly off screen
            if (firstFullyOnScreenIndex === undefined && top >= scroll - 10) {
                firstFullyOnScreenIndex = i;
            }

            if (startBuffered === null && top + size > scrollTopBuffered) {
                startBuffered = i;
                startBufferedId = id;
                nextTop = top;
            }
            if (startNoBuffer !== null) {
                if (top <= scrollBottom) {
                    endNoBuffer = i;
                }
                if (top <= scrollBottomBuffered) {
                    endBuffered = i;
                    nextBottom = top + size;
                } else {
                    foundEnd = true;
                }
            }
        }
    }

    const idsInView: string[] = [];
    for (let i = firstFullyOnScreenIndex!; i <= endNoBuffer!; i++) {
        const id = idCache.get(i) ?? getId(state, i)!;
        idsInView.push(id);
    }

    Object.assign(state, {
        startBuffered,
        startBufferedId,
        startNoBuffer,
        endBuffered,
        endNoBuffer,
        idsInView,
        firstFullyOnScreenIndex,
    });

    // Precompute the scroll that will be needed for the range to change
    // so it can be skipped if not needed
    if (enableScrollForNextCalculateItemsInView && nextTop !== undefined && nextBottom !== undefined) {
        state.scrollForNextCalculateItemsInView =
            nextTop !== undefined && nextBottom !== undefined
                ? {
                      top: nextTop,
                      bottom: nextBottom,
                  }
                : undefined;
    }

    const numContainers = peek$(ctx, "numContainers");
    // Reset containers that aren't used anymore because the data has changed
    const pendingRemoval: number[] = [];
    if (dataChanged) {
        for (let i = 0; i < numContainers; i++) {
            const itemKey = peek$(ctx, `containerItemKey${i}`);
            if (!state.props.keyExtractor || (itemKey && indexByKey.get(itemKey) === undefined)) {
                pendingRemoval.push(i);
            }
        }
    }

    if (startBuffered !== null && endBuffered !== null) {
        let numContainers = prevNumContainers;
        const needNewContainers: number[] = [];

        for (let i = startBuffered!; i <= endBuffered; i++) {
            const id = idCache.get(i) ?? getId(state, i)!;
            if (!containerItemKeys.has(id)) {
                needNewContainers.push(i);
            }
        }

        if (needNewContainers.length > 0) {
            const availableContainers = findAvailableContainers(
                ctx,
                state,
                needNewContainers.length,
                startBuffered,
                endBuffered,
                pendingRemoval,
            );
            for (let idx = 0; idx < needNewContainers.length; idx++) {
                const i = needNewContainers[idx];
                const containerIndex = availableContainers[idx];
                const id = idCache.get(i) ?? getId(state, i)!;

                // Remove old key from cache
                const oldKey = peek$(ctx, `containerItemKey${containerIndex}`);
                if (oldKey && oldKey !== id) {
                    containerItemKeys!.delete(oldKey);
                }

                set$(ctx, `containerItemKey${containerIndex}`, id);
                set$(ctx, `containerItemData${containerIndex}`, data[i]);

                // Update cache when adding new item
                containerItemKeys!.add(id);

                if (containerIndex >= numContainers) {
                    numContainers = containerIndex + 1;
                }
            }

            if (numContainers !== prevNumContainers) {
                set$(ctx, "numContainers", numContainers);
                if (numContainers > peek$(ctx, "numContainersPooled")) {
                    set$(ctx, "numContainersPooled", Math.ceil(numContainers * 1.5));
                }
            }
        }

        // Update top positions of all containers
        for (let i = 0; i < numContainers; i++) {
            const itemKey = peek$(ctx, `containerItemKey${i}`);

            // If it was
            if (pendingRemoval.includes(i)) {
                // Update cache when removing item
                if (itemKey) {
                    containerItemKeys!.delete(itemKey);
                }

                set$(ctx, `containerItemKey${i}`, undefined);
                set$(ctx, `containerItemData${i}`, undefined);
                set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
                set$(ctx, `containerColumn${i}`, -1);
            } else {
                const itemIndex = indexByKey.get(itemKey)!;
                const item = data[itemIndex];
                if (item !== undefined) {
                    const id = idCache.get(itemIndex) ?? getId(state, itemIndex);
                    const position = positions.get(id);

                    if (position === undefined) {
                        // This item may have been in view before data changed and positions were reset
                        // so we need to set it to out of view
                        set$(ctx, `containerPosition${i}`, POSITION_OUT_OF_VIEW);
                    } else {
                        const pos = positions.get(id)!;
                        const column = columns.get(id) || 1;

                        const prevPos = peek$(ctx, `containerPosition${i}`);
                        const prevColumn = peek$(ctx, `containerColumn${i}`);
                        const prevData = peek$(ctx, `containerItemData${i}`);

                        if (!prevPos || (pos > POSITION_OUT_OF_VIEW && pos !== prevPos)) {
                            set$(ctx, `containerPosition${i}`, pos);
                        }
                        if (column >= 0 && column !== prevColumn) {
                            set$(ctx, `containerColumn${i}`, column);
                        }

                        if (prevData !== item) {
                            set$(ctx, `containerItemData${i}`, data[itemIndex]);
                        }
                    }
                }
            }
        }
    }

    if (!queuedInitialLayout && endBuffered !== null) {
        // If waiting for initial layout and all items in view have a known size then
        // initial layout is complete
        if (checkAllSizesKnown(state)) {
            setDidLayout(ctx, state);
        }
    }

    if (state.props.viewabilityConfigCallbackPairs) {
        updateViewableItems(
            state,
            ctx,
            state.props.viewabilityConfigCallbackPairs,
            scrollLength,
            startNoBuffer!,
            endNoBuffer!,
        );
    }
}
