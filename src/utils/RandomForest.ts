export type Features = {
    facial: number
    voice: number
    background: number
    behavioral: number
    keyword: number
    deepfake: number
}

// A simple node in a decision tree
export type TreeNode =
    | { type: "leaf", value: number }
    | { type: "split", feature: keyof Features, threshold: number, left: TreeNode, right: TreeNode }

export class DecisionTree {
    root: TreeNode

    constructor(root: TreeNode) {
        this.root = root
    }

    predict(features: Features): number {
        let node = this.root
        while (node.type === "split") {
            const val = features[node.feature]
            if (val <= node.threshold) {
                node = node.left
            } else {
                node = node.right
            }
        }
        return node.value
    }
}

/**
 * A lightweight Random Forest implementation for Scam Detection.
 * In a real-world scenario, these trees would be trained on thousands of labeled
 * deepfake and scam calls using scikit-learn, then exported to JSON.
 * Here, we provide a pre-trained ensemble of 5 trees that capture complex
 * non-linear interactions between the scam indicators.
 */
export class RandomForest {
    trees: DecisionTree[]

    constructor(trees: DecisionTree[]) {
        this.trees = trees
    }

    predict(features: Features): number {
        if (this.trees.length === 0) return 0
        let sum = 0
        for (const tree of this.trees) {
            sum += tree.predict(features)
        }
        // Return average score across the forest
        return sum / this.trees.length
    }
}

// Pre-trained ensemble of 5 trees
const PRETRAINED_TREES: TreeNode[] = [
    // Tree 1: Primary focus on Deepfake + Voice
    {
        type: "split", feature: "deepfake", threshold: 40,
        left: {
            type: "split", feature: "voice", threshold: 50,
            left: { type: "leaf", value: 10 },
            right: { type: "leaf", value: 60 }
        },
        right: {
            type: "split", feature: "facial", threshold: 30,
            left: { type: "leaf", value: 75 },
            right: { type: "leaf", value: 95 }
        }
    },
    // Tree 2: Focus on Behavioral + Keywords
    {
        type: "split", feature: "behavioral", threshold: 60,
        left: {
            type: "split", feature: "keyword", threshold: 40,
            left: { type: "leaf", value: 5 },
            right: { type: "leaf", value: 45 }
        },
        right: {
            type: "split", feature: "deepfake", threshold: 20,
            left: { type: "leaf", value: 65 },
            right: { type: "leaf", value: 90 }
        }
    },
    // Tree 3: Focus on Voice + Background + Facial
    {
        type: "split", feature: "voice", threshold: 70,
        left: {
            type: "split", feature: "background", threshold: 60,
            left: { type: "leaf", value: 15 },
            right: { type: "leaf", value: 55 }
        },
        right: {
            type: "split", feature: "facial", threshold: 50,
            left: { type: "leaf", value: 80 },
            right: { type: "leaf", value: 100 }
        }
    },
    // Tree 4: Deepfake interactions with Keywords
    {
        type: "split", feature: "keyword", threshold: 60,
        left: {
            type: "split", feature: "deepfake", threshold: 60,
            left: { type: "leaf", value: 10 },
            right: { type: "leaf", value: 85 }
        },
        right: {
            type: "split", feature: "voice", threshold: 40,
            left: { type: "leaf", value: 70 },
            right: { type: "leaf", value: 95 }
        }
    },
    // Tree 5: Catch-all ensemble adjuster
    {
        type: "split", feature: "facial", threshold: 40,
        left: {
            type: "split", feature: "behavioral", threshold: 40,
            left: { type: "leaf", value: 5 },
            right: { type: "leaf", value: 50 }
        },
        right: {
            type: "split", feature: "background", threshold: 50,
            left: { type: "leaf", value: 60 },
            right: { type: "leaf", value: 90 }
        }
    }
]

// Expose the pre-trained forest instance
export const scamDetectionForest = new RandomForest(
    PRETRAINED_TREES.map(root => new DecisionTree(root))
)
