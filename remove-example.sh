EXAMPLE_NAME=$1
EXAMPLE_DIR="examples/$EXAMPLE_NAME"

// check if directory exists
if [ ! -d "$EXAMPLE_DIR" ]; then
    echo "Example does not exist: $EXAMPLE_NAME"
    exit 1
fi
echo "Removing example: $EXAMPLE_NAME"
rm -rf $EXAMPLE_DIR
echo "Removed example: $EXAMPLE_NAME"
