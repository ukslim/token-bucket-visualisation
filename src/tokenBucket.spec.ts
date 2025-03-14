import {
  addRequest,
  addToken,
  createInitialState,
  formatState,
  updateState,
} from "./tokenBucket";

describe("Token Bucket", () => {
  test("creates initial state with correct values", () => {
    const state = createInitialState(10, 5, 60);

    expect(state.bucket.level).toBe(10);
    expect(state.bucket.maxLevel).toBe(10);
    expect(state.items).toEqual([]);
    expect(state.nextId).toBe(1);
    expect(state.frameCount).toBe(0);
    expect(state.tokensPerSecond).toBe(5);
    expect(state.framesPerSecond).toBe(60);
    expect(state.framesUntilNextToken).toBe(12); // 60 / 5 = 12
  });

  test("adds a request to the state", () => {
    const initialState = createInitialState(10, 5, 60);
    const newState = addRequest(initialState);

    expect(newState.items.length).toBe(1);
    expect(newState.items[0]).toEqual({
      id: 1,
      age: 0,
      position: 0,
      type: "request",
    });
    expect(newState.nextId).toBe(2);
  });

  test("adds a token to the state", () => {
    const initialState = createInitialState(10, 5, 60);
    initialState.bucket.level = 5; // Half-full bucket

    const newState = addToken(initialState);

    expect(newState.items.length).toBe(1);
    expect(newState.items[0]).toEqual({
      id: 1,
      age: 0,
      position: 0,
      type: "token",
    });
    expect(newState.nextId).toBe(2);
    expect(newState.framesUntilNextToken).toBe(12); // Reset to 60 / 5 = 12
  });

  test("updates positions of items as they age", () => {
    let state = createInitialState(10, 5, 60);
    state = addRequest(state);

    // Age the request by 60 frames (halfway to bucket)
    for (let i = 0; i < 60; i++) {
      state = updateState(state);
    }

    // Item should be halfway to the bucket
    expect(state.items[0].position).toBe(50);
    expect(state.items[0].age).toBe(60);
  });

  test("processes request when tokens are available", () => {
    let state = createInitialState(10, 5, 60);
    state = addRequest(state);

    // Age the request to reach the bucket
    for (let i = 0; i < 120; i++) {
      state = updateState(state);
    }

    // Request should be processed
    expect(state.items[0].type).toBe("processed");
    expect(state.bucket.level).toBe(9); // 10 - 1 = 9
  });

  test("drops request when not enough tokens are available", () => {
    let state = createInitialState(10, 0, 60);
    state.bucket.level = 0;
    state = addRequest(state);

    // Age the request to reach the bucket
    for (let i = 0; i < 120; i++) {
      state = updateState(state);
    }

    // Request should be dropped
    expect(state.items[0].type).toBe("dropped");
    expect(state.bucket.level).toBe(0);
  });

  test("adds new tokens at the correct rate", () => {
    let state = createInitialState(10, 5, 60);
    state.bucket.level = 0; // Empty bucket

    // Advance 12 frames (should add one token)
    for (let i = 0; i < 12; i++) {
      state = updateState(state);
    }

    // Should have added a token item
    expect(state.items.length).toBe(1);
    expect(state.items[0].type).toBe("token");

    // Advance another 12 frames to allow token to reach bucket
    for (let i = 0; i < 121; i++) {
      state = updateState(state);
    }

    // Token should have been absorbed into the bucket
    expect(state.bucket.level).toBe(1);
    // Token item should be removed after reaching bucket
    expect(state.items.length).toBe(11);
  });

  test("removes processed items after their lifetime", () => {
    let state = createInitialState(10, 0, 60);
    state = addRequest(state);

    // Age the request to reach the bucket and get processed
    for (let i = 0; i < 120; i++) {
      state = updateState(state);
    }

    expect(state.items.length).toBe(1);
    expect(state.items[0].type).toBe("processed");

    // Age the processed request to complete its lifetime
    for (let i = 0; i < 121; i++) {
      state = updateState(state);
    }

    // Processed item should be removed
    expect(state.items.length).toBe(0);
  });

  test("does not allow bucket to exceed maximum capacity", () => {
    let state = createInitialState(10, 5, 60);

    // Try to add tokens to a full bucket
    for (let i = 0; i < 24; i++) {
      state = updateState(state);
    }

    // Bucket should remain at max capacity
    expect(state.bucket.level).toBe(10);
  });

  test("formats state into readable text representation", () => {
    // Create a state with various types of items
    let state = createInitialState(10, 0, 60);
    state.bucket.level = 5;

    // Add a token
    state = addToken(state);
    state.items[0].age = 15;

    // Add a request
    state = addRequest(state);
    state.items[1].age = 30;

    // Add a processed request
    state = addRequest(state);
    state.items[2].age = 150;
    state.items[2].type = "processed";

    // Add a dropped request
    state = addRequest(state);
    state.items[3].age = 180;
    state.items[3].type = "dropped";

    const formatted = formatState(state);

    // Check the format
    expect(formatted).toBe(
      "Bucket: 5/10 tokens\n" +
        "Tokens: [15]\n" +
        "Requests: [30]\n" +
        "Dropped: [180]\n" +
        "Processed: [150]"
    );
  });
});
