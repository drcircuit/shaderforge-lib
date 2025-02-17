#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: ./create-example.sh <example-name>"
    exit 1
fi

# First build and package the library
echo "Building library package..."
npm run clean || {
    echo "Failed to clean library package"
    exit 1
}
npm run package || {
    echo "Failed to build library package"
    exit 1
}

EXAMPLE_NAME=$1
TEMPLATE_DIR="templates/basic"
EXAMPLE_DIR="examples/$EXAMPLE_NAME"

# Create example directory
mkdir -p "$EXAMPLE_DIR"

# Copy all template files and directories
cp -r "$TEMPLATE_DIR/"* "$EXAMPLE_DIR/"

# Update package name in package.json
sed -i "s/\"name\": \"hello-world\"/\"name\": \"$EXAMPLE_NAME\"/" "$EXAMPLE_DIR/package.json"

# Update title in index.html
sed -i "s/ShaderForge Effect/ShaderForge: $EXAMPLE_NAME/" "$EXAMPLE_DIR/index.html"

# Install dependencies
echo "Installing dependencies..."
cd "$EXAMPLE_DIR"
npm install || {
    echo "Failed to install dependencies"
    exit 1
}
echo "Dependencies installed"
echo "Building example..."
npm run build || {
    echo "Failed to build example"
    exit 1
}

echo "Created new example: $EXAMPLE_NAME"
echo "To run the example:"
echo "  npm run preview # to preview production build"
