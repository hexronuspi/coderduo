import { Plan } from "@/types/subscription";
import { RazorpayOptions, RazorpaySuccessResponse } from "@/types/razorpay";

// Function to load the Razorpay SDK dynamically
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      console.log("Razorpay already loaded");
      resolve(true);
      return;
    }
    
    console.log("Loading Razorpay script...");
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      console.log("Razorpay script loaded successfully");
      resolve(true);
    };
    
    script.onerror = () => {
      console.error('Razorpay SDK failed to load');
      resolve(false);
    };
    
    document.body.appendChild(script);
  });
};

interface PaymentOptions {
  userId: string;
  pack: Plan;
  name: string;
  email: string;
  onSuccess: (response: { verificationData: { success: boolean; orderId: string; error?: string; }; pack: Plan } & RazorpaySuccessResponse) => void;
  onError: (error: Error | unknown) => void;
}

// Function to initialize and open the Razorpay payment gateway
export const initiateRazorpayPayment = async ({
  userId,
  pack,
  name,
  email,
  onSuccess,
  onError
}: PaymentOptions) => {
  try {
    console.log("Initiating Razorpay payment process for:", pack.name);
    
    // Load Razorpay script if not already loaded
    const isScriptLoaded = await loadRazorpayScript();
    if (!isScriptLoaded) {
      throw new Error('Failed to load Razorpay SDK');
    }
    
    if (!window.Razorpay) {
      console.error("Razorpay object not available even after script loaded");
      throw new Error('Razorpay initialization failed');
    }

    console.log("Creating order on server...");
    
    // Create an order on your server with better error handling
    let orderResponse;
    try {
      orderResponse = await fetch('/api/payment/razorpay/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          packId: pack.id,
          amount: pack.price,
          planId: pack.id,
          credits: pack.credits,
          notes: {
            userId: userId,
            packName: pack.name,
            credits: pack.credits, // Include credits in notes for webhook processing
            packId: pack.id
          }
        }),
      });

      console.log("Order API response status:", orderResponse.status);
    } catch (networkError) {
      console.error("Network error while creating order:", networkError);
      throw new Error('Network error connecting to payment server. Please check your internet connection.');
    }
    
    if (!orderResponse.ok) {
      let errorData;
      try {
        errorData = await orderResponse.json();
      } catch (parseError) {
        console.error("Failed to parse error response:", parseError);
        throw new Error(`Server error: ${orderResponse.status} ${orderResponse.statusText}`);
      }
      
      console.error("Order creation failed:", errorData);
      
      // Provide more detailed error messages based on the response
      if (errorData.message) {
        throw new Error(`Payment error: ${errorData.message}`);
      } else if (errorData.error) {
        throw new Error(errorData.error);
      } else {
        throw new Error(`Failed to create order (${orderResponse.status})`);
      }
    }

    const orderData = await orderResponse.json();
    console.log("Order created successfully:", orderData.razorpayOrderId);

    // Configure Razorpay options
    const options: RazorpayOptions = {
      key: orderData.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
      amount: orderData.amount,
      currency: orderData.currency || "INR",
      name: 'Coder Duo',
      description: `${pack.name} - ${pack.credits} Credits`,
      order_id: orderData.razorpayOrderId,
      prefill: {
        name: name,
        email: email,
      },
      notes: {
        userId: userId,
        packId: pack.id,
        credits: pack.credits,
        orderId: orderData.orderId
      },
      theme: {
        color: '#6366F1', // Primary color
      },
      modal: {
        ondismiss: function() {
          console.log('Payment modal closed without completing payment');
        },
      },
      handler: async function(response: RazorpaySuccessResponse) {
        console.log("Payment successful, verifying...", response);
        try {
          // Verify the payment on the server with improved error handling
          console.log("Sending payment verification request...");
          let verificationResponse;
          try {
            verificationResponse = await fetch('/api/payment/razorpay/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                packId: pack.id,
                userId: userId,
                credits: pack.credits, // Add credits here for direct verification
                amount: pack.price, // Include amount for additional verification
                currency: 'INR'
              }),
            });
          } catch (networkError) {
            console.error("Network error during payment verification:", networkError);
            throw new Error("Network error during payment verification. Your payment may have been processed but couldn't be verified. Please contact support.");
          }

          console.log("Verification response status:", verificationResponse.status);
          
          if (!verificationResponse.ok) {
            console.error("Verification server error:", verificationResponse.status, verificationResponse.statusText);
            throw new Error(`Payment verification server error: ${verificationResponse.status}. Please contact support with your payment ID: ${response.razorpay_payment_id}`);
          }
          
          let verificationData;
          try {
            verificationData = await verificationResponse.json();
            console.log("Verification result:", verificationData);
          } catch (parseError) {
            console.error("Failed to parse verification response:", parseError);
            throw new Error("Error processing verification response. Please contact support with your payment ID: " + response.razorpay_payment_id);
          }

          if (verificationData.success) {
            onSuccess({
              ...response,
              verificationData,
              pack
            });
          } else {
            console.error("Payment verification failed:", verificationData);
            onError(new Error('Payment verification failed: ' + (verificationData.error || '')));
          }
        } catch (error) {
          console.error('Error verifying payment:', error);
          onError(error);
        }
      },
    };

    console.log("Initializing Razorpay with options:", { 
      key: options.key, 
      order_id: options.order_id,
      amount: options.amount
    });
    
    // Initialize Razorpay
    if (!window.Razorpay) {
      throw new Error('Razorpay is not available. Please check if the script was loaded correctly.');
    }
    
    const razorpay = new window.Razorpay(options);
    
    console.log("Opening Razorpay payment modal...");
    // Open the payment modal
    razorpay.open();
    console.log("Razorpay modal should be open now");
    
  } catch (error) {
    console.error('Error initiating Razorpay payment:', error);
    alert(`Payment initiation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    onError(error);
  }
};
