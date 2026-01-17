
// Test script for path normalization logic

function getCleanPath(webkitRelativePath) {
    if (!webkitRelativePath) return '';

    // Normalize slashes to forward slashes just in case
    const normalized = webkitRelativePath.replace(/\\/g, '/');

    // If it has a slash, strip the first component
    if (normalized.includes('/')) {
        return normalized.substring(normalized.indexOf('/') + 1);
    }

    return normalized;
}

const testCases = [
    { input: "myProject/src/index.js", expected: "src/index.js" },
    { input: "myProject/package.json", expected: "package.json" },
    { input: "myProject/components/Button.jsx", expected: "components/Button.jsx" },
    // Edge cases
    { input: "folder/file.txt", expected: "file.txt" },
    { input: "deep/nested/folder/structure/file.js", expected: "nested/folder/structure/file.js" },
    // Windows style input (though browser usually gives forward slash)
    { input: "myProject\\src\\index.js", expected: "src/index.js" },
];

console.log("Running path logic tests...");
let passed = 0;
testCases.forEach(test => {
    const result = getCleanPath(test.input);
    if (result === test.expected) {
        console.log(`✅ [PASS] Input: "${test.input}" -> Output: "${result}"`);
        passed++;
    } else {
        console.error(`❌ [FAIL] Input: "${test.input}"\n   Expected: "${test.expected}"\n   Actual:   "${result}"`);
    }
});

if (passed === testCases.length) {
    console.log("\nAll tests passed!");
} else {
    console.log(`\n${passed}/${testCases.length} tests passed.`);
}
