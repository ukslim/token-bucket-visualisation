/**
 * Token Bucket Algorithm Model
 * This file contains the data structures and logic for simulating a token bucket algorithm
 */

// Type representing an item (request or token)
export type Item = {
  id: number; // Unique identifier
  age: number; // Age of the item in animation frames
  position: number; // Position from 0 to 100 (0 = start, 100 = at bucket)
  type: "request" | "token" | "processed" | "dropped"; // Type of item
};

// Type representing the bucket
export type Bucket = {
  level: number; // Current token level
  maxLevel: number; // Maximum token capacity
};

// Type representing the entire system state
export type State = {
  bucket: Bucket;
  items: Item[];
  nextId: number;
  frameCount: number;
  tokensPerSecond: number;
  framesPerSecond: number;
  framesUntilNextToken: number;
  // Request producer parameters
  requestsPerSecond: number;
  requestBurstiness: number;
  framesUntilNextRequest: number;
};

// Constants for animation
const FRAMES_TO_REACH_BUCKET = 120; // How many frames it takes an item to reach the bucket
const PROCESSED_ITEM_LIFETIME = 120; // How many frames a processed item lives after being processed
const DROPPED_ITEM_LIFETIME = 120; // How many frames a dropped item lives after being dropped

/**
 * Create an initial state
 */
export function createInitialState(
  maxLevel: number,
  tokensPerSecond: number,
  framesPerSecond: number,
  requestsPerSecond: number = 0,
  requestBurstiness: number = 0
): State {
  return {
    bucket: {
      level: maxLevel, // Start with a full bucket
      maxLevel,
    },
    items: [],
    nextId: 1,
    frameCount: 0,
    tokensPerSecond,
    framesPerSecond,
    framesUntilNextToken: Math.floor(framesPerSecond / tokensPerSecond),
    requestsPerSecond,
    requestBurstiness,
    framesUntilNextRequest:
      requestsPerSecond > 0
        ? Math.floor(framesPerSecond / requestsPerSecond)
        : 0,
  };
}

/**
 * Add a new request to the system
 */
export function addRequest(state: State, burstiness: number = 0): State {
  // Calculate initial age based on burstiness
  // Higher burstiness means more variation in starting positions
  let initialAge = 0;

  if (burstiness > 0) {
    // Generate a random age between 0 and (burstiness * FRAMES_TO_REACH_BUCKET / 2)
    // This makes some requests appear closer to the bucket (higher initial age)
    const maxOffset = Math.floor((burstiness * FRAMES_TO_REACH_BUCKET) / 2);
    initialAge = Math.floor(Math.random() * maxOffset);
  }

  const newItem: Item = {
    id: state.nextId,
    age: initialAge,
    position: Math.floor((initialAge / FRAMES_TO_REACH_BUCKET) * 100), // Calculate position based on age
    type: "request",
  };

  return {
    ...state,
    items: [...state.items, newItem],
    nextId: state.nextId + 1,
    // Reset the request timer if this was an auto-generated request
    framesUntilNextRequest:
      state.requestsPerSecond > 0
        ? Math.floor(state.framesPerSecond / state.requestsPerSecond)
        : state.framesUntilNextRequest,
  };
}

/**
 * Add a new token to the system
 */
export function addToken(state: State): State {
  const newItem: Item = {
    id: state.nextId,
    age: 0,
    position: 0,
    type: "token",
  };

  return {
    ...state,
    items: [...state.items, newItem],
    nextId: state.nextId + 1,
    framesUntilNextToken: Math.floor(
      state.framesPerSecond / state.tokensPerSecond
    ),
  };
}

/**
 * Set the bucket size (maxLevel) and ensure current level doesn't exceed it
 */
export function setBucketSize(state: State, newSize: number): State {
  return {
    ...state,
    bucket: {
      // Update max level
      maxLevel: newSize,
      // Ensure current level doesn't exceed the new max level
      level: Math.min(state.bucket.level, newSize),
    },
  };
}

/**
 * Format the state as a readable text representation
 */
export function formatState(state: State): string {
  // Format bucket information
  const bucketInfo = `Bucket: ${state.bucket.level}/${state.bucket.maxLevel} tokens`;

  // Filter items by type and extract ages
  const tokens = state.items
    .filter((item) => item.type === "token")
    .map((item) => item.age);

  const requests = state.items
    .filter((item) => item.type === "request")
    .map((item) => item.age);

  const dropped = state.items
    .filter((item) => item.type === "dropped")
    .map((item) => item.age);

  const processed = state.items
    .filter((item) => item.type === "processed")
    .map((item) => item.age);

  // Format each category
  const tokensInfo = `Tokens: [${tokens.join(", ")}]`;
  const requestsInfo = `Requests: [${requests.join(", ")}]`;
  const droppedInfo = `Dropped: [${dropped.join(", ")}]`;
  const processedInfo = `Processed: [${processed.join(", ")}]`;

  // Combine all information
  return [
    bucketInfo,
    tokensInfo,
    requestsInfo,
    droppedInfo,
    processedInfo,
  ].join("\n");
}

/**
 * Update the state for one frame of animation
 */
export function updateState(state: State): State {
  const newState = { ...state, frameCount: state.frameCount + 1 };

  // Update token generation timer
  newState.framesUntilNextToken = Math.max(
    0,
    newState.framesUntilNextToken - 1
  );

  // Update request generation timer
  if (newState.requestsPerSecond > 0) {
    newState.framesUntilNextRequest = Math.max(
      0,
      newState.framesUntilNextRequest - 1
    );
  }

  // Add new token if it's time
  if (newState.framesUntilNextToken === 0) {
    return updateState(addToken(newState));
  }

  // Add new request if it's time and auto request generation is enabled
  if (newState.requestsPerSecond > 0 && newState.framesUntilNextRequest === 0) {
    return updateState(addRequest(newState, newState.requestBurstiness));
  }

  // Update all items
  const updatedItems: Item[] = [];
  let newBucketLevel = newState.bucket.level;

  // Process each item
  for (const item of newState.items) {
    const newItem = { ...item, age: item.age + 1 };

    // Update position based on age and type
    if (newItem.type === "request" || newItem.type === "token") {
      newItem.position = Math.min(
        100,
        Math.floor((newItem.age / FRAMES_TO_REACH_BUCKET) * 100)
      );
    } else if (newItem.type === "processed" || newItem.type === "dropped") {
      newItem.position = Math.min(
        200,
        100 +
          Math.floor(
            ((newItem.age - FRAMES_TO_REACH_BUCKET) / PROCESSED_ITEM_LIFETIME) *
              100
          )
      );
    }

    // Handle items that have reached the bucket
    if (
      newItem.position === 100 &&
      (newItem.type === "request" || newItem.type === "token")
    ) {
      if (newItem.type === "token") {
        // Add token to bucket if there's space
        if (newBucketLevel < newState.bucket.maxLevel) {
          newBucketLevel += 1;
          // Don't keep the token item
          continue;
        } else {
          // If bucket is full, token is wasted - don't keep it in the state
          continue;
        }
      } else if (newItem.type === "request") {
        // Process request if there are enough tokens
        if (newBucketLevel > 0) {
          newBucketLevel -= 1;
          newItem.type = "processed";
        } else {
          // Drop request if not enough tokens
          newItem.type = "dropped";
        }
      }
    }

    // Remove processed or dropped items that have lived their full lifetime
    if (
      (newItem.type === "processed" &&
        newItem.age > FRAMES_TO_REACH_BUCKET + PROCESSED_ITEM_LIFETIME) ||
      (newItem.type === "dropped" &&
        newItem.age > FRAMES_TO_REACH_BUCKET + DROPPED_ITEM_LIFETIME)
    ) {
      continue;
    }

    updatedItems.push(newItem);
  }

  return {
    ...newState,
    bucket: {
      ...newState.bucket,
      level: newBucketLevel,
    },
    items: updatedItems,
  };
}
