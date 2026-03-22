// Test script to verify client selection functionality
// Run this in the browser console on the order creation page

console.log('🧪 Testing client selection functionality...');

// Check if the page is loaded
if (window.location.pathname.includes('/pedidos/criar')) {
    console.log('✅ On order creation page');

    // Check if client dropdown elements exist
    const clientInput = document.querySelector('input[placeholder*="Buscar cliente"]');
    const clientDropdown = document.querySelector('.absolute.z-50');

    console.log('📋 Client input found:', !!clientInput);
    console.log('📋 Client dropdown found:', !!clientDropdown);

    if (clientInput) {
        console.log('🎯 Focusing on client input...');
        clientInput.focus();

        setTimeout(() => {
            console.log('📝 Typing test search...');
            clientInput.value = 'test';
            clientInput.dispatchEvent(new Event('input', { bubbles: true }));

            setTimeout(() => {
                const dropdown = document.querySelector('.absolute.z-50');
                console.log('📋 Dropdown visible after typing:', !!dropdown);

                if (dropdown) {
                    const clientItems = dropdown.querySelectorAll('.cursor-pointer');
                    console.log('👥 Client items found:', clientItems.length);

                    if (clientItems.length > 0) {
                        console.log('🎯 Clicking first client...');
                        clientItems[0].click();

                        setTimeout(() => {
                            const selectedClient = document.querySelector('.bg-green-50');
                            console.log('✅ Client selected:', !!selectedClient);
                        }, 500);
                    }
                }
            }, 500);
        }, 500);
    }
} else {
    console.log('❌ Not on order creation page. Navigate to /pedidos/criar first.');
}