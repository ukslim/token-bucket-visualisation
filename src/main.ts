import "./style.css";
import {
  addRequest,
  createInitialState,
  formatState,
  Item,
  setBucketSize,
  updateState,
} from "./tokenBucket";

// Create the initial simulation state
const DEFAULT_BUCKET_MAX_LEVEL = 10;
const DEFAULT_TOKENS_PER_SECOND = 1;
const DEFAULT_FRAMES_PER_SECOND = 30;
const DEFAULT_REQUESTS_PER_SECOND = 1;
const DEFAULT_REQUEST_BURSTINESS = 0.5;

let state = createInitialState(
  DEFAULT_BUCKET_MAX_LEVEL,
  DEFAULT_TOKENS_PER_SECOND,
  DEFAULT_FRAMES_PER_SECOND,
  DEFAULT_REQUESTS_PER_SECOND,
  DEFAULT_REQUEST_BURSTINESS
);

let isRunning = true;
const frameInterval = 1000 / DEFAULT_FRAMES_PER_SECOND;
let lastFrameTime = 0;

// Canvas dimensions
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;

// Bucket dimensions and position
const BUCKET_WIDTH = 200;
const BUCKET_HEIGHT = 300;
const BUCKET_X = (CANVAS_WIDTH - BUCKET_WIDTH) / 2;
const BUCKET_Y = (CANVAS_HEIGHT - BUCKET_HEIGHT) / 2;
const BUCKET_BORDER_WIDTH = 10;

// Item dimensions
const ITEM_SIZE = 20;
const ITEM_PADDING = 10;
// Position tokens much higher than requests
const TOKEN_Y = BUCKET_Y + BUCKET_HEIGHT / 5; // Tokens at 1/5 down the bucket height
const REQUEST_Y = BUCKET_Y + (BUCKET_HEIGHT * 4) / 5; // Requests at 4/5 down the bucket height
const PROCESSED_Y = BUCKET_Y + (BUCKET_HEIGHT * 3) / 5; // Processed items exit higher
const DROPPED_Y = BUCKET_Y + BUCKET_HEIGHT + 30; // Dropped items exit much lower

// Setup the UI
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <h1>Token Bucket Visualization</h1>
    <div class="visualization">
      <canvas id="bucket-canvas" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}"></canvas>
    </div>
    
    <div class="controls">
      <button id="add-request">Add Request</button>
      <button id="toggle-simulation">Pause</button>
      <button id="reset-simulation">Reset</button>
    </div>
    
    <div class="settings">
      <div class="setting">
        <label for="tokens-per-second">Tokens per second ("rate"):</label>
        <input type="range" id="tokens-per-second" min="0.1" max="5" step="0.1" value="${DEFAULT_TOKENS_PER_SECOND}">
        <span id="tokens-per-second-value">${DEFAULT_TOKENS_PER_SECOND}</span>
      </div>
      
      <div class="setting">
        <label for="bucket-size">Bucket size ("burst"):</label>
        <input type="range" id="bucket-size" min="1" max="20" step="1" value="${DEFAULT_BUCKET_MAX_LEVEL}">
        <span id="bucket-size-value">${DEFAULT_BUCKET_MAX_LEVEL}</span>
      </div>
      
      <div class="setting">
        <label for="requests-per-second">Auto requests per second:</label>
        <input type="range" id="requests-per-second" min="0" max="5" step="0.1" value="${DEFAULT_REQUESTS_PER_SECOND}">
        <span id="requests-per-second-value">${DEFAULT_REQUESTS_PER_SECOND}</span>
      </div>
      
      <div class="setting">
        <label for="request-burstiness">Request burstiness:</label>
        <input type="range" id="request-burstiness" min="0" max="2" step="0.1" value="${DEFAULT_REQUEST_BURSTINESS}">
        <span id="request-burstiness-value">${DEFAULT_REQUEST_BURSTINESS}</span>
      </div>
    </div>
    

    
    <!--
    <div class="simulation-status">
      <div>Frame: <span id="frame-count">0</span></div>
    </div>
    
     <pre id="state-display"></pre>
      -->

      <div class="explanation">
        <p>
          This is a visualization of the <strong>token bucket algorithm</strong>, a method for rate-limiting requests. This algorithm is used
          by AWS API Gateway, and others, to allow a certain number of requests per second, while still allowing bursts of requests.
        </p>
        <p>
          To handle a request, a token must be removed from the bucket. If the bucket is empty, the request is dropped. Meanwhile, the
          bucket is replenished at a configured rate. Therefore, if requests arrive more often than the refill rate, the bucket will empty
          and requests will be dropped. However, since the bucket can hold a quantity of tokens, it can allow bursts of requests. 
        </p>
        <p>
          Try setting the rate to 1, the burst to 1, requests per second to 1, and burstiness to 0. <button id="no-burst-demo" class="inline-button">Try it</button> See how in its steady state, the bucket 
          alternates between 1 and 0, and all requests are successful.
        </p>
        <p>
          Now increase the "Request burstiness". This continues to emit requests at the same average rate, but their spacing is randomised. See how
          now some requests are dropped, because they arrive before the bucket is replenished.
        </p>
        <p>
          Play with the parameters and get a feel for how rate and burst work together.
        </p>
        <p>
          Source is on <a href="https://github.com/ukslim/token-bucket-visualisation">GitHub</a>.
        </p>
      </div>
  </div>
`;

// Get the display elements
const stateDisplay = document.getElementById("state-display") as HTMLPreElement;
const frameCountDisplay = document.getElementById(
  "frame-count"
) as HTMLSpanElement;
const tokenRateDisplay = document.getElementById(
  "tokens-per-second-value"
) as HTMLSpanElement;
const bucketSizeDisplay = document.getElementById(
  "bucket-size-value"
) as HTMLSpanElement;
const requestRateDisplay = document.getElementById(
  "requests-per-second-value"
) as HTMLSpanElement;
const requestBurstinessDisplay = document.getElementById(
  "request-burstiness-value"
) as HTMLSpanElement;
const canvas = document.getElementById("bucket-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

/**
 * Draw an individual item (token or request)
 */
function drawItem(item: Item) {
  if (!ctx) return;

  let x = 0;
  let y = 0;
  let color = "";

  // Calculate position based on item type and position value
  if (item.type === "token") {
    // Tokens moving toward the bucket (0-100)
    x =
      (item.position / 100) * (BUCKET_X - ITEM_SIZE - ITEM_PADDING) +
      ITEM_PADDING;
    y = TOKEN_Y;
    color = "#4aff94"; // Green for tokens
  } else if (item.type === "request") {
    // Requests moving toward the bucket (0-100)
    x =
      (item.position / 100) * (BUCKET_X - ITEM_SIZE - ITEM_PADDING) +
      ITEM_PADDING;
    y = REQUEST_Y;
    color = "#ffff4a"; // Yellow for requests
  } else if (item.type === "processed") {
    // Processed items moving away from the bucket (100-200)
    const awayPosition = item.position - 100;
    x =
      BUCKET_X +
      BUCKET_WIDTH +
      ITEM_PADDING +
      (awayPosition / 100) *
        (CANVAS_WIDTH - BUCKET_X - BUCKET_WIDTH - ITEM_SIZE - ITEM_PADDING);
    y = PROCESSED_Y;
    color = "#4affff"; // Cyan for processed requests
  } else if (item.type === "dropped") {
    // Dropped items moving away from the bucket (100-200)
    const awayPosition = item.position - 100;

    if (awayPosition < 20) {
      // First move down from the bucket
      x = BUCKET_X + BUCKET_WIDTH / 2;
      y =
        BUCKET_Y +
        BUCKET_HEIGHT +
        (awayPosition / 20) * (DROPPED_Y - (BUCKET_Y + BUCKET_HEIGHT));
    } else {
      // Then move right
      const horizontalProgress = (awayPosition - 20) / 80; // 80 = 100 - 20, remaining progress
      x =
        BUCKET_X +
        BUCKET_WIDTH / 2 +
        horizontalProgress *
          (CANVAS_WIDTH - ITEM_PADDING - (BUCKET_X + BUCKET_WIDTH / 2));
      y = DROPPED_Y;
    }

    color = "#ff4a4a"; // Red for dropped requests
  }

  // Draw the item as a circle
  ctx.beginPath();
  ctx.arc(x + ITEM_SIZE / 2, y, ITEM_SIZE / 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Draw a smaller outline for the item
  ctx.beginPath();
  ctx.arc(x + ITEM_SIZE / 2, y, ITEM_SIZE / 2 + 2, 0, Math.PI * 2);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Add a label to the item to make it more clear
  ctx.fillStyle = "#000";
  ctx.font = "10px Arial";
  ctx.textAlign = "center";
  ctx.fillText(item.type.charAt(0).toUpperCase(), x + ITEM_SIZE / 2, y + 3);
}

/**
 * Draw the paths for items to follow
 */
function drawPaths() {
  if (!ctx) return;

  // Set up dotted line style
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#000"; // Light green for tokens

  // Draw token input path
  ctx.beginPath();
  ctx.moveTo(ITEM_PADDING, TOKEN_Y);
  ctx.lineTo(BUCKET_X, TOKEN_Y);
  ctx.stroke();

  // Draw request input path
  ctx.beginPath();
  ctx.moveTo(ITEM_PADDING, REQUEST_Y);
  ctx.lineTo(BUCKET_X, REQUEST_Y);
  ctx.stroke();

  // Draw processed output path
  ctx.beginPath();
  ctx.moveTo(BUCKET_X + BUCKET_WIDTH, PROCESSED_Y);
  ctx.lineTo(CANVAS_WIDTH - ITEM_PADDING, PROCESSED_Y);
  ctx.stroke();

  // Draw dropped output path
  ctx.beginPath();
  ctx.moveTo(BUCKET_X + BUCKET_WIDTH / 2, BUCKET_Y + BUCKET_HEIGHT); // Start from bottom of bucket
  ctx.lineTo(BUCKET_X + BUCKET_WIDTH / 2, DROPPED_Y); // Go down
  ctx.lineTo(CANVAS_WIDTH - ITEM_PADDING, DROPPED_Y); // Go right
  ctx.stroke();

  // Reset line dash
  ctx.setLineDash([]);
}

/**
 * Draw the token bucket and its current level
 */
function drawBucket() {
  if (!ctx) return;

  // Clear the canvas
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Draw paths for items
  drawPaths();

  // Draw the bucket outline
  ctx.strokeStyle = "#AAF";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = BUCKET_BORDER_WIDTH;
  ctx.beginPath();
  ctx.moveTo(BUCKET_X, BUCKET_Y); // Start at top left
  ctx.lineTo(BUCKET_X, BUCKET_Y + BUCKET_HEIGHT); // Draw left wall
  ctx.lineTo(BUCKET_X + BUCKET_WIDTH, BUCKET_Y + BUCKET_HEIGHT); // Draw bottom wall
  ctx.lineTo(BUCKET_X + BUCKET_WIDTH, BUCKET_Y); // Draw right wall
  ctx.stroke();

  // Calculate token level height
  const maxInnerHeight = BUCKET_HEIGHT - 2 * BUCKET_BORDER_WIDTH;
  const levelHeight =
    (state.bucket.level / state.bucket.maxLevel) * maxInnerHeight;

  // Draw the token level (water level)
  ctx.fillStyle = "#4a94ff";
  ctx.fillRect(
    BUCKET_X + BUCKET_BORDER_WIDTH / 2,
    BUCKET_Y + BUCKET_HEIGHT - BUCKET_BORDER_WIDTH / 2 - levelHeight,
    BUCKET_WIDTH - BUCKET_BORDER_WIDTH,
    levelHeight
  );

  // Draw token level text
  ctx.fillStyle = "#000";
  ctx.font = "24px Arial";
  ctx.textAlign = "center";
  ctx.fillText(
    `${state.bucket.level}/${state.bucket.maxLevel}`,
    BUCKET_X + BUCKET_WIDTH / 2,
    BUCKET_Y + BUCKET_HEIGHT / 2
  );

  // Draw items
  state.items.forEach(drawItem);

  // Draw labels
  ctx.fillStyle = "#000";
  ctx.font = "16px Arial";
  ctx.textAlign = "left";

  // Label the item paths
  ctx.font = "12px Arial";
  ctx.fillText("Tokens", ITEM_PADDING * 2, TOKEN_Y - 15);
  ctx.fillText("Requests", ITEM_PADDING * 2, REQUEST_Y - 15);
  ctx.textAlign = "right";
  ctx.fillText("Processed", CANVAS_WIDTH - ITEM_PADDING * 5, PROCESSED_Y - 15);
  ctx.fillText("Dropped", CANVAS_WIDTH - ITEM_PADDING * 5, DROPPED_Y - 15);
}

// Add event listener for adding requests
const addRequestButton = document.getElementById("add-request");
if (addRequestButton) {
  addRequestButton.addEventListener("click", () => {
    state = addRequest(state);
  });
}

// Toggle simulation running state
const toggleButton = document.getElementById(
  "toggle-simulation"
) as HTMLButtonElement;
if (toggleButton) {
  toggleButton.addEventListener("click", () => {
    isRunning = !isRunning;
    toggleButton.textContent = isRunning ? "Pause" : "Resume";
  });
}

// Reset simulation
const resetButton = document.getElementById("reset-simulation");
if (resetButton) {
  resetButton.addEventListener("click", () => {
    const tokensPerSecond = Number(
      (document.getElementById("tokens-per-second") as HTMLInputElement).value
    );
    const bucketSize = Number(
      (document.getElementById("bucket-size") as HTMLInputElement).value
    );
    const requestsPerSecond = Number(
      (document.getElementById("requests-per-second") as HTMLInputElement).value
    );
    const requestBurstiness = Number(
      (document.getElementById("request-burstiness") as HTMLInputElement).value
    );

    state = createInitialState(
      bucketSize,
      tokensPerSecond,
      DEFAULT_FRAMES_PER_SECOND,
      requestsPerSecond,
      requestBurstiness
    );
  });
}

// Update tokens per second
const tokensPerSecondInput = document.getElementById(
  "tokens-per-second"
) as HTMLInputElement;
if (tokensPerSecondInput) {
  tokensPerSecondInput.addEventListener("input", () => {
    const tokensPerSecond = Number(tokensPerSecondInput.value);
    state.tokensPerSecond = tokensPerSecond;
    state.framesUntilNextToken = Math.floor(
      state.framesPerSecond / tokensPerSecond
    );
    tokenRateDisplay.textContent = tokensPerSecond.toString();
  });
}

// Update bucket size
const bucketSizeInput = document.getElementById(
  "bucket-size"
) as HTMLInputElement;
if (bucketSizeInput) {
  bucketSizeInput.addEventListener("input", () => {
    const bucketSize = Number(bucketSizeInput.value);
    state = setBucketSize(state, bucketSize);
    bucketSizeDisplay.textContent = bucketSize.toString();
  });
}

// Update request rate
const requestsPerSecondInput = document.getElementById(
  "requests-per-second"
) as HTMLInputElement;
if (requestsPerSecondInput) {
  requestsPerSecondInput.addEventListener("input", () => {
    const requestsPerSecond = Number(requestsPerSecondInput.value);
    state.requestsPerSecond = requestsPerSecond;

    // Reset the frames until next request
    if (requestsPerSecond > 0) {
      state.framesUntilNextRequest = Math.floor(
        state.framesPerSecond / requestsPerSecond
      );
    } else {
      state.framesUntilNextRequest = 0;
    }

    requestRateDisplay.textContent = requestsPerSecond.toString();
  });
}

// Update request burstiness
const requestBurstinessInput = document.getElementById(
  "request-burstiness"
) as HTMLInputElement;
if (requestBurstinessInput) {
  requestBurstinessInput.addEventListener("input", () => {
    const requestBurstiness = Number(requestBurstinessInput.value);
    state.requestBurstiness = requestBurstiness;
    requestBurstinessDisplay.textContent = requestBurstiness.toString();
  });
}

// Add event listener for the "Try it" button
const noBurstDemo = document.getElementById("no-burst-demo");
if (noBurstDemo) {
  noBurstDemo.addEventListener("click", () => {
    // Set the parameters as suggested in the text
    const tokensPerSecondInput = document.getElementById(
      "tokens-per-second"
    ) as HTMLInputElement;
    const bucketSizeInput = document.getElementById(
      "bucket-size"
    ) as HTMLInputElement;
    const requestsPerSecondInput = document.getElementById(
      "requests-per-second"
    ) as HTMLInputElement;
    const requestBurstinessInput = document.getElementById(
      "request-burstiness"
    ) as HTMLInputElement;

    // Set values
    tokensPerSecondInput.value = "1";
    bucketSizeInput.value = "1";
    requestsPerSecondInput.value = "1";
    requestBurstinessInput.value = "0";

    // Trigger the input events to update the state
    tokensPerSecondInput.dispatchEvent(new Event("input"));
    bucketSizeInput.dispatchEvent(new Event("input"));
    requestsPerSecondInput.dispatchEvent(new Event("input"));
    requestBurstinessInput.dispatchEvent(new Event("input"));

    // Reset the simulation with the new parameters
    const resetButton = document.getElementById(
      "reset-simulation"
    ) as HTMLButtonElement;
    if (resetButton) {
      resetButton.click();
      // set an offset between token and request emission
      // so that you can see the bucket alternate between 0 and 1
      state.framesUntilNextToken = 0;
      state.framesUntilNextRequest = Math.floor(DEFAULT_FRAMES_PER_SECOND / 2);
    }
  });
}

// Animation loop
function animationLoop(timestamp: number) {
  // Calculate time difference
  const elapsed = timestamp - lastFrameTime;

  // Only update if enough time has passed and simulation is running
  if (elapsed >= frameInterval && isRunning) {
    // Update the simulation state
    state = updateState(state);

    // Update displays
    if (stateDisplay) {
      stateDisplay.textContent = formatState(state);
    }
    if (frameCountDisplay) {
      frameCountDisplay.textContent = state.frameCount.toString();
    }

    // Draw the bucket visualization
    drawBucket();

    // Update last frame time
    lastFrameTime = timestamp;
  }

  // Schedule the next frame
  requestAnimationFrame(animationLoop);
}

// Initial draw
drawBucket();

// Start the animation loop
requestAnimationFrame(animationLoop);
