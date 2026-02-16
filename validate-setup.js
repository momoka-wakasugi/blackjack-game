// Simple validation script to check project structure
const fs = require('fs');
const path = require('path');

console.log('🔍 Validating project structure...\n');

const requiredFiles = [
    'package.json',
    'README.md',
    '.gitignore',
    'vitest.config.js',
    'src/server/index.js',
    'src/client/index.html',
    'src/client/game.html',
    'src/client/styles/main.css',
    'src/client/styles/game.css',
    'src/client/js/room-selection.js',
    'src/client/js/GameUI.js',
    'src/client/js/SocketClient.js',
    'src/client/js/game.js'
];

const requiredDirectories = [
    'src',
    'src/server',
    'src/server/game',
    'src/server/websocket',
    'src/client',
    'src/client/styles',
    'src/client/js',
    'tests'
];

let allValid = true;

// Check directories
console.log('📁 Checking directories:');
requiredDirectories.forEach(dir => {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        console.log(`✅ ${dir}`);
    } else {
        console.log(`❌ ${dir} - Missing directory`);
        allValid = false;
    }
});

console.log('\n📄 Checking files:');
// Check files
requiredFiles.forEach(file => {
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} - Missing file`);
        allValid = false;
    }
});

// Check package.json content
console.log('\n📦 Validating package.json:');
try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    const requiredDeps = ['express', 'socket.io', 'uuid'];
    const requiredDevDeps = ['nodemon', 'vitest', 'fast-check'];
    
    requiredDeps.forEach(dep => {
        if (packageJson.dependencies && packageJson.dependencies[dep]) {
            console.log(`✅ Dependency: ${dep}`);
        } else {
            console.log(`❌ Missing dependency: ${dep}`);
            allValid = false;
        }
    });
    
    requiredDevDeps.forEach(dep => {
        if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
            console.log(`✅ Dev dependency: ${dep}`);
        } else {
            console.log(`❌ Missing dev dependency: ${dep}`);
            allValid = false;
        }
    });
    
} catch (error) {
    console.log(`❌ Error reading package.json: ${error.message}`);
    allValid = false;
}

console.log('\n' + '='.repeat(50));
if (allValid) {
    console.log('🎉 Project structure validation PASSED!');
    console.log('\n📋 Next steps:');
    console.log('1. Install Node.js (version 16.0.0 or higher)');
    console.log('2. Run: npm install');
    console.log('3. Run: npm run dev');
    console.log('4. Open browser to http://localhost:3000');
} else {
    console.log('❌ Project structure validation FAILED!');
    console.log('Please check the missing files/directories above.');
}
console.log('='.repeat(50));