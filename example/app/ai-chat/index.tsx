import { LegendList } from "@legendapp/list";
import { useHeaderHeight } from "@react-navigation/elements";
import { useEffect, useState } from "react";
import { Dimensions, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Message = {
    id: string;
    text: string;
    sender: "user" | "system";
    timeStamp: number;
    isPlaceholder?: boolean;
};

let idCounter = 0;

const AIChat = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const headerHeight = Platform.OS === "ios" ? useHeaderHeight() : 80;
    const screenHeight = Dimensions.get("window").height;
    const availableHeight = screenHeight - headerHeight; // Subtract header and some padding

    useEffect(() => {
        // After 1 second, add user message and system placeholder
        const timer1 = setTimeout(() => {
            setMessages([
                {
                    id: String(idCounter++),
                    text: "Hey, can you help me understand how React Native virtualization works?",
                    sender: "user",
                    timeStamp: Date.now(),
                },
                {
                    id: String(idCounter++),
                    text: "",
                    sender: "system",
                    timeStamp: Date.now(),
                    isPlaceholder: true,
                },
            ]);
        }, 1000);

        // After 3 seconds total (2 seconds after the first), replace placeholder with long message
        const timer2 = setTimeout(() => {
            setMessages((prevMessages) =>
                prevMessages.map((msg) =>
                    msg.isPlaceholder
                        ? {
                              id: String(idCounter++),
                              sender: "system",
                              timeStamp: Date.now(),
                              text: `React Native virtualization is a performance optimization technique that's crucial for handling large lists efficiently. Here's how it works:

1. **Rendering Only Visible Items**: Instead of rendering all items in a list at once, virtualization only renders the items that are currently visible on screen, plus a small buffer of items just outside the visible area.

2. **Dynamic Item Creation/Destruction**: As you scroll, items that move out of view are removed from the DOM/native view hierarchy, and new items that come into view are created. This keeps memory usage constant regardless of list size.

3. **View Recycling**: Advanced virtualization systems reuse view components rather than creating new ones, which reduces garbage collection and improves performance.

4. **Estimated vs Actual Sizing**: The system uses estimated item sizes to calculate scroll positions and total content size, then adjusts as actual sizes are measured.

5. **Legend List Implementation**: Legend List enhances this by providing better handling of dynamic item sizes, bidirectional scrolling, and maintains scroll position more accurately than FlatList.

The key benefits are:
- Constant memory usage regardless of data size
- Smooth scrolling performance
- Better handling of dynamic content
- Reduced time to interactive

This makes it possible to scroll through thousands of items without performance degradation, which is essential for modern mobile apps dealing with large datasets like social media feeds, chat histories, or product catalogs.`,
                              isPlaceholder: false,
                          }
                        : msg,
                ),
            );
        }, 3000);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, []);

    return (
        <SafeAreaView style={styles.container} edges={["bottom"]}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior="padding"
                keyboardVerticalOffset={headerHeight}
                contentContainerStyle={{ flex: 1 }}
            >
                <LegendList
                    data={messages}
                    contentContainerStyle={styles.contentContainer}
                    keyExtractor={(item) => item.id}
                    estimatedItemSize={60}
                    maintainVisibleContentPosition
                    maintainScrollAtEnd
                    alignItemsAtEnd
                    renderItem={({ item }) => (
                        <>
                            {item.isPlaceholder ? (
                                <View
                                    style={[
                                        styles.systemMessageContainer,
                                        styles.systemStyle,
                                        { minHeight: availableHeight * 0.9 }, // Take up most of available space
                                    ]}
                                >
                                    <View style={[styles.placeholderContainer, styles.messageContainer]}>
                                        <View style={styles.typingIndicator}>
                                            <View style={[styles.dot, styles.dot1]} />
                                            <View style={[styles.dot, styles.dot2]} />
                                            <View style={[styles.dot, styles.dot3]} />
                                        </View>
                                        <Text style={styles.placeholderText}>AI is thinking...</Text>
                                    </View>
                                </View>
                            ) : (
                                <View
                                    style={[
                                        styles.messageContainer,
                                        item.sender === "system"
                                            ? styles.systemMessageContainer
                                            : styles.userMessageContainer,
                                        item.sender === "system" ? styles.systemStyle : styles.userStyle,
                                    ]}
                                >
                                    <Text
                                        style={[styles.messageText, item.sender === "user" && styles.userMessageText]}
                                    >
                                        {item.text}
                                    </Text>
                                    <View
                                        style={[
                                            styles.timeStamp,
                                            item.sender === "system" ? styles.systemStyle : styles.userStyle,
                                        ]}
                                    >
                                        <Text style={styles.timeStampText}>
                                            {new Date(item.timeStamp).toLocaleTimeString()}
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </>
                    )}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    contentContainer: {
        paddingHorizontal: 16,
    },
    messageContainer: {
        padding: 16,
        borderRadius: 16,
        marginVertical: 4,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
    },
    userMessageText: {
        color: "white",
    },
    systemMessageContainer: {},
    userMessageContainer: {
        backgroundColor: "#007AFF",
    },
    systemStyle: {
        maxWidth: "85%",
        alignSelf: "flex-start",
    },
    userStyle: {
        maxWidth: "75%",
        alignSelf: "flex-end",
        alignItems: "flex-end",
    },
    timeStamp: {
        marginVertical: 5,
    },
    timeStampText: {
        fontSize: 12,
        color: "#888",
    },
    placeholderContainer: {
        backgroundColor: "#f8f9fa",
        borderWidth: 1,
        borderColor: "#e9ecef",
    },
    typingIndicator: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#007AFF",
        marginHorizontal: 2,
    },
    dot1: {
        animationName: "typing",
        animationDuration: "1.4s",
        animationIterationCount: "infinite",
        animationDelay: "0s",
    },
    dot2: {
        animationName: "typing",
        animationDuration: "1.4s",
        animationIterationCount: "infinite",
        animationDelay: "0.2s",
    },
    dot3: {
        animationName: "typing",
        animationDuration: "1.4s",
        animationIterationCount: "infinite",
        animationDelay: "0.4s",
    },
    placeholderText: {
        fontSize: 14,
        color: "#666",
        fontStyle: "italic",
    },
});

export default AIChat;
