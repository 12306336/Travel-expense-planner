$(document).ready(function() {
    // Initialize date picker
    $('#travelDates').daterangepicker({
        opens: 'right',
        autoUpdateInput: false,
        locale: {
            cancelLabel: 'Clear',
            format: 'MMM D, YYYY'
        }
    });

    $('#travelDates').on('apply.daterangepicker', function(ev, picker) {
        $(this).val(picker.startDate.format('MMM D, YYYY') + ' - ' + picker.endDate.format('MMM D, YYYY'));
    });

    $('#travelDates').on('cancel.daterangepicker', function(ev, picker) {
        $(this).val('');
    });

    // Update preview section in real-time
    $('input, select').on('input change', function() {
        updatePreview();
    });

    function updatePreview() {
        $('#previewRoute').text($('#source').val() + ' → ' + $('#destination').val());
        $('#previewDuration').text($('#duration').val() + ' days');
        $('#previewTravelers').text($('#travelers').val() + ' ' + ($('#travelers').val() == 1 ? 'person' : 'people'));
        
        const budget = $('#budget').val();
        if (budget) {
            $('#previewBudget').text('₹' + Number(budget).toLocaleString('en-IN'));
        }
    }

    // Form submission handler
    $('#travelForm').submit(async function(e) {
        e.preventDefault();
        
        // Show loading indicator
        $('#loadingIndicator').removeClass('hidden');
        $('#resultsContainer').addClass('hidden');
        $('#errorContainer').addClass('hidden');
        
        // Get form data
        const formData = {
            source: $('#source').val(),
            destination: $('#destination').val(),
            travelers: $('#travelers').val(),
            duration: $('#duration').val(),
            travelDates: $('#travelDates').val(),
            accommodation: $('#accommodation').val(),
            dining: $('#dining').val(),
            activities: $('#activities').val(),
            budget: $('#budget').val(),
            additionalInfo: $('#additionalInfo').val(),
            currency: 'INR'
        };
        
        // Validate inputs
        if (!formData.source || !formData.destination) {
            showError('Please enter both source and destination cities');
            return;
        }
        
        if (formData.source.toLowerCase() === formData.destination.toLowerCase()) {
            showError('Source and destination cannot be the same');
            return;
        }
        
        try {
            // Generate prompt for Gemini API with strict instructions
            const prompt = generatePrompt(formData);
            
            // Call Gemini API
            const response = await callGeminiAPI(prompt);
            
            // Parse the response
            const parsedResponse = parseAIResponse(response);
            
            // Display results
            displayResults(parsedResponse);
            
            // Hide loading indicator
            $('#loadingIndicator').addClass('hidden');
            $('#resultsContainer').removeClass('hidden');
            
            // Scroll to results
            $('html, body').animate({
                scrollTop: $('#resultsContainer').offset().top - 20
            }, 500);
        } catch (error) {
            console.error('Error:', error);
            showError(error.message || 'An error occurred while generating your travel plan. Please try again.');
        }
    });
    
    function showError(message) {
        $('#errorMessage').text(message);
        $('#errorContainer').removeClass('hidden');
        $('#loadingIndicator').addClass('hidden');
        
        $('html, body').animate({
            scrollTop: $('#errorContainer').offset().top - 20
        }, 500);
    }
    
    // Function to generate the prompt for Gemini API with strict instructions
    function generatePrompt(formData) {
        return `Act as a professional travel planner specializing in Indian travel. Create a detailed travel budget plan in Indian Rupees (₹) based on:
        
Source: ${formData.source}
Destination: ${formData.destination}
Travelers: ${formData.travelers}
Duration: ${formData.duration} days
Dates: ${formData.travelDates || 'Flexible'}
Stay: ${formData.accommodation}
Food: ${formData.dining}
Activities: ${formData.activities}
Budget: ₹${formData.budget || 'Flexible'}
Notes: ${formData.additionalInfo || 'None'}

IMPORTANT INSTRUCTIONS:
1. All prices must be in Indian Rupees (₹) only
2. Focus on practical options for Indian travelers
3. Include local transport options (trains, buses, autos)
4. Suggest Indian food options matching the preference
5. Account for GST where applicable
6. Recommend booking platforms popular in India (IRCTC, MakeMyTrip, Yatra)

Required sections (format clearly with headings):

1. TRIP SUMMARY
- Best travel routes from ${formData.source} to ${formData.destination}
- Weather expectations
- Cultural notes
- Important alerts (monsoon, festivals, etc.)

2. BUDGET BREAKDOWN (in ₹)
- Transportation (breakdown by mode)
- Accommodation (per night cost)
- Food (per day estimate)
- Activities/Entry fees
- Miscellaneous (SIM card, tips, etc.)
- Total estimated cost comparison to budget

3. DAILY ITINERARY
- Day-wise schedule with time approximations
- Include travel times between locations
- Meal suggestions (mention local specialties)
- Cost estimates for each activity

4. MONEY-SAVING TIPS
- Specific to Indian travelers
- Best value accommodations
- Affordable eating options
- Free/cheap activities
- Local transport hacks

5. IMPORTANT CONTACTS
- Emergency numbers
- Local tourism office
- Recommended hospitals
- Nearest Indian embassy if international

Format using markdown with clear headings. Be precise with costs in ₹ and practical for Indian travelers.`;
    }
    
    // Function to call Gemini API
    async function callGeminiAPI(prompt) {
        const API_KEY = 'AIzaSyBhjBIghyjRD6Z1DJP2noOOXNLCJaO3Hpg'; // Replace with your actual key
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
        
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topP: 0.9,
                        topK: 40,
                        maxOutputTokens: 2048
                    },
                    safetySettings: [
                        {
                            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_HARASSMENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_HATE_SPEECH",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        }
                    ]
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
                throw new Error('Unexpected API response format');
            }
            
            // Check for blocked content
            if (data.candidates[0].finishReason === "SAFETY") {
                throw new Error('Response blocked due to safety concerns');
            }
            
            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error('Error calling Gemini API:', error);
            throw error;
        }
    }
    
    // Function to parse the AI response
    function parseAIResponse(responseText) {
        const sections = {
            tripSummary: '',
            budgetBreakdown: '',
            dailyItinerary: '',
            moneySavingTips: '',
            importantContacts: ''
        };
        
        // Enhanced parsing with fallbacks
        const sectionPatterns = [
            { name: 'tripSummary', regex: /1\. TRIP SUMMARY[\s\S]+?(?=2\. BUDGET BREAKDOWN|$)/i },
            { name: 'budgetBreakdown', regex: /2\. BUDGET BREAKDOWN[\s\S]+?(?=3\. DAILY ITINERARY|$)/i },
            { name: 'dailyItinerary', regex: /3\. DAILY ITINERARY[\s\S]+?(?=4\. MONEY-SAVING TIPS|$)/i },
            { name: 'moneySavingTips', regex: /4\. MONEY-SAVING TIPS[\s\S]+?(?=5\. IMPORTANT CONTACTS|$)/i },
            { name: 'importantContacts', regex: /5\. IMPORTANT CONTACTS[\s\S]+?$/i }
        ];
        
        sectionPatterns.forEach(section => {
            const match = responseText.match(section.regex);
            if (match) {
                sections[section.name] = match[0].replace(section.regex.toString().split('\\')[0], '').trim();
            }
        });
        
        // Ensure all prices are in INR
        Object.keys(sections).forEach(key => {
            sections[key] = sections[key].replace(/\$(\d+)/g, '₹$1')
                                       .replace(/USD/g, 'INR')
                                       .replace(/dollars/g, 'rupees');
        });
        
        return sections;
    }
    
    // Function to display results
    function displayResults(results) {
        const resultsHtml = `
            <div class="bg-blue-50 rounded-xl p-6 mb-6">
                <h3 class="text-xl font-semibold text-blue-800 mb-4 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Trip Summary
                </h3>
                <div class="prose max-w-none">${formatText(results.tripSummary)}</div>
            </div>
            
            <div class="bg-green-50 rounded-xl p-6 mb-6">
                <h3 class="text-xl font-semibold text-green-800 mb-4 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Budget Breakdown (INR)
                </h3>
                <div class="prose max-w-none">${formatText(results.budgetBreakdown)}</div>
            </div>
            
            <div class="bg-purple-50 rounded-xl p-6 mb-6">
                <h3 class="text-xl font-semibold text-purple-800 mb-4 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Daily Itinerary
                </h3>
                <div class="prose max-w-none">${formatText(results.dailyItinerary)}</div>
            </div>
            
            <div class="bg-yellow-50 rounded-xl p-6 mb-6">
                <h3 class="text-xl font-semibold text-yellow-800 mb-4 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                    </svg>
                    Money-Saving Tips
                </h3>
                <div class="prose max-w-none">${formatText(results.moneySavingTips)}</div>
            </div>
            
            ${results.importantContacts ? `
            <div class="bg-red-50 rounded-xl p-6">
                <h3 class="text-xl font-semibold text-red-800 mb-4 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Important Contacts
                </h3>
                <div class="prose max-w-none">${formatText(results.importantContacts)}</div>
            </div>
            ` : ''}
        `;
        
        $('#resultsContent').html(resultsHtml);
        
        // Add animation to results
        $('.bg-blue-50, .bg-green-50, .bg-purple-50, .bg-yellow-50, .bg-red-50').hide().each(function(index) {
            $(this).delay(100 * index).fadeIn(300);
        });
    }
    
    // Helper function to format text (convert markdown to HTML)
    function formatText(text) {
        if (!text) return '<p class="text-gray-500">No information available for this section.</p>';
        
        // Convert markdown headers
        let formatted = text.replace(/^#\s+(.*)$/gm, '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>');
        formatted = formatted.replace(/^##\s+(.*)$/gm, '<h4 class="font-medium mt-4 mb-1">$1</h4>');
        
        // Convert markdown bold and italic
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Convert markdown lists
        formatted = formatted.replace(/^\s*-\s*(.*)$/gm, '<li class="ml-5 list-disc">$1</li>');
        formatted = formatted.replace(/^\s*\*\s*(.*)$/gm, '<li class="ml-5 list-disc">$1</li>');
        formatted = formatted.replace(/(<li>.*<\/li>)+/g, function(match) {
            return '<ul class="list-inside space-y-1 my-2">' + match + '</ul>';
        });
        
        // Convert markdown tables
        formatted = formatted.replace(/\|(.+?)\|/g, function(match) {
            return match.replace(/\|/g, '</td><td>').replace(/^<\/td>/, '<tr><td>').replace(/<\/td>$/, '</td></tr>');
        });
        formatted = formatted.replace(/<tr><td>(.+?)<\/td><\/tr>/g, function(match, header) {
            const headers = header.split(/<\/td><td>/);
            return '<thead><tr>' + headers.map(h => `<th class="px-4 py-2 bg-gray-100 border">${h.trim()}</th>`).join('') + '</tr></thead>';
        });
        formatted = formatted.replace(/<tr><td>(.+?)<\/td><\/tr>/g, function(match, row) {
            const cells = row.split(/<\/td><td>/);
            return '<tr>' + cells.map(c => `<td class="px-4 py-2 border">${c.trim()}</td>`).join('') + '</tr>';
        });
        formatted = formatted.replace(/<thead>.+?<\/thead>.+?<tr>/g, function(match) {
            return match.replace(/<tr>/, '<tbody><tr>');
        });
        formatted = formatted.replace(/<\/tr>(?!.*<\/tr>)/, '</tr></tbody>');
        formatted = formatted.replace(/<table>/g, '<table class="min-w-full border my-4">');
        
        // Convert line breaks to paragraphs
        formatted = formatted.split('\n\n').filter(p => p.trim().length > 0).map(paragraph => {
            if (paragraph.startsWith('<') || paragraph.match(/^<[a-z]+>/i)) {
                return paragraph;
            }
            return `<p class="mb-3">${paragraph}</p>`;
        }).join('');
        
        return formatted;
    }
    
    // Initialize preview
    updatePreview();
});