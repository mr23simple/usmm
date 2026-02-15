import { SlackFormatter } from '../src/utils/SlackFormatter.js';

const testInput = `
<div class="header">🧪 Formatter Regression Test</div>

<div class="section">
  This is a <b>bold</b> and <i>italic</i> test with a <a href="https://example.com">standard link</a>.
  <br />
  It also has <code>inline code</code> and a <br> manual break.
</div>

<hr />

<div class="section">
  <div class="field"><b>Field 1</b><br />Value A</div>
  <div class="field"><b>Field 2</b><br />Value B</div>
  <img src="https://api.slack.com/img/blocks/baking/cake.png" alt="Cake" />
</div>

<a class="btn-primary" value="confirm_test">
  Confirm Action
  <confirm title="Are you sure?" confirm="Yes" deny="No">
    Please confirm this regression test.
  </confirm>
</a>

<div class="context">
  <img src="https://api.slack.com/img/blocks/baking/cookie.png" alt="Cookie" />
  Mixed <i>context</i> element.
</div>
`;

console.log('--- USMM REGRESSION INPUT ---');
const blocks = SlackFormatter.parse(testInput);
console.log(JSON.stringify(blocks, null, 2));
