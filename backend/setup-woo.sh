#!/bin/bash
set -e

# Wait for WordPress to be ready
echo "Waiting for WordPress..."
until wp core is-installed --allow-root; do
    echo "WordPress not ready yet..."
    sleep 5
done

echo "WordPress is ready. Installing WooCommerce..."
wp plugin install woocommerce --activate --allow-root

echo "Installing Storefront theme..."
wp theme install storefront --activate --allow-root

# Force install WooCommerce pages (Shop, Cart, Checkout, My Account)
echo "Installing WooCommerce pages..."
wp wc tool run install_pages --user=1 --allow-root

echo "Creating dummy products..."
wp wc product create --name="Cool T-Shirt" --type=simple --regular_price=25 --description="A very cool t-shirt." --user=1 --images='[{"src":"https://placehold.co/400.png"}]' --allow-root
wp wc product create --name="Awesome Hoodie" --type=simple --regular_price=50 --description="Keeps you warm." --user=1 --images='[{"src":"https://placehold.co/400.png"}]' --allow-root
wp wc product create --name="Stylish Hat" --type=simple --regular_price=15 --description="Protect your head." --user=1 --images='[{"src":"https://placehold.co/400.png"}]' --allow-root

echo "Configuring Homepage..."

# Retry loop to find the Shop page
for i in {1..5}; do
    SHOP_PAGE_ID=$(wp post list --post_type=page --post_title=Shop --format=ids --posts_per_page=1 --allow-root)
    if [ ! -z "$SHOP_PAGE_ID" ]; then
        echo "Found Shop Page ID: '$SHOP_PAGE_ID'"
        break
    else
        echo "Shop page not found, retrying in 2 seconds... (Attempt $i/5)"
        sleep 2
    fi
done

if [ ! -z "$SHOP_PAGE_ID" ]; then
    echo "Setting Shop (ID: $SHOP_PAGE_ID) as homepage..."
    
    # 1. Set show_on_front to 'page'
    wp option update show_on_front 'page' --allow-root
    # Verify
    SOF_VAL=$(wp option get show_on_front --allow-root)
    echo "VERIFY: show_on_front is now '$SOF_VAL'"

    # 2. Set page_on_front to the Shop ID
    wp option update page_on_front $SHOP_PAGE_ID --allow-root
    # Verify
    POF_VAL=$(wp option get page_on_front --allow-root)
    echo "VERIFY: page_on_front is now '$POF_VAL'"

    if [ "$SOF_VAL" == "page" ] && [ "$POF_VAL" == "$SHOP_PAGE_ID" ]; then
        echo "SUCCESS: Homepage configured successfully."
    else
        echo "WARNING: Homepage configuration mismatch."
    fi
else
    echo "ERROR: Shop page not found after retries! Listing all pages for debug:"
    wp post list --post_type=page --allow-root
fi

echo "WooCommerce setup complete!"

# Enable Cash on Delivery
echo "Enabling Cash on Delivery..."
wp option update woocommerce_cod_settings '{"enabled":"yes"}' --format=json --allow-root

# Disable Setup Wizard
echo "Disabling Setup Wizard..."
wp option set woocommerce_task_list_hidden yes --allow-root

# Flush Permalinks (Essential for Checkout page to work)
echo "Flushing permalinks..."
wp rewrite structure '/%postname%/' --allow-root
wp rewrite flush --hard --allow-root
