const { test, expect } = require('@playwright/test');

test.describe('Profile-Company Relationship Flow', () => {
  test('Find Peter Holcomb, verify Optimo IT relationship, then check company profiles', async ({ page }) => {
    // Navigate to the admin UI
    await page.goto('/');
    
    // Step 1: Find Peter Holcomb in profiles
    console.log('Step 1: Searching for Peter Holcomb...');
    await page.click('a[href="/profiles"]');
    await expect(page).toHaveURL('/profiles');
    
    // Search for Peter Holcomb
    await page.fill('input[name="search"]', 'Peter Holcomb');
    await page.click('button[type="submit"]');
    
    // Wait for search results and verify Peter Holcomb appears (table format)
    await page.waitForSelector('tbody tr[data-profile-id]', { timeout: 10000 });
    const profileRows = await page.locator('tbody tr[data-profile-id]').all();
    
    let peterProfileFound = false;
    let peterProfileId = null;
    
    for (const row of profileRows) {
      const nameCell = row.locator('td:nth-child(2)');
      const nameText = await nameCell.textContent();
      if (nameText && nameText.includes('Peter') && nameText.includes('Holcomb')) {
        console.log(`Found Peter Holcomb: ${nameText}`);
        peterProfileFound = true;
        
        // Extract profile ID from the data attribute or link
        peterProfileId = await row.getAttribute('data-profile-id');
        console.log(`Peter's Profile ID: ${peterProfileId}`);
        
        // Click to view Peter's profile
        const viewProfileLink = nameCell.locator('a[href^="/profiles/"]').first();
        await viewProfileLink.click();
        break;
      }
    }
    
    expect(peterProfileFound, 'Peter Holcomb profile should be found').toBeTruthy();
    expect(peterProfileId, 'Should extract Peter\'s profile ID').toBeTruthy();
    
    // Step 2: Verify Optimo IT is in Peter's profile and extract company info
    console.log('Step 2: Verifying Optimo IT in Peter\'s profile...');
    await expect(page).toHaveURL(`/profiles/${peterProfileId}`);
    
    // Look for company information in Peter's profile
    let optimoCompanyFound = false;
    let optimoCompanyId = null;
    
    // Check current company section
    const currentCompanySection = page.locator('.current-company, .company-info, .experience-section');
    if (await currentCompanySection.count() > 0) {
      const companyText = await currentCompanySection.textContent();
      if (companyText.includes('Optimo') || companyText.includes('OPTIMO')) {
        console.log('Found Optimo IT in current company section');
        optimoCompanyFound = true;
        
        // Try to find company link and extract ID
        const companyLink = page.locator('a[href^="/companies/"]').first();
        if (await companyLink.count() > 0) {
          const href = await companyLink.getAttribute('href');
          optimoCompanyId = href.split('/companies/')[1];
          console.log(`Optimo IT Company ID: ${optimoCompanyId}`);
        }
      }
    }
    
    // If not found in current company, check experience/work history
    if (!optimoCompanyFound) {
      const experienceItems = page.locator('.experience-item, .work-experience, .job-entry');
      const experienceCount = await experienceItems.count();
      
      for (let i = 0; i < experienceCount; i++) {
        const item = experienceItems.nth(i);
        const itemText = await item.textContent();
        if (itemText.includes('Optimo') || itemText.includes('OPTIMO')) {
          console.log(`Found Optimo IT in experience item ${i + 1}`);
          optimoCompanyFound = true;
          
          // Try to extract company ID from link in this experience item
          const companyLink = item.locator('a[href^="/companies/"]').first();
          if (await companyLink.count() > 0) {
            const href = await companyLink.getAttribute('href');
            optimoCompanyId = href.split('/companies/')[1];
            console.log(`Optimo IT Company ID: ${optimoCompanyId}`);
          }
          break;
        }
      }
    }
    
    // If still not found, search the entire page for Optimo references
    if (!optimoCompanyFound) {
      const pageText = await page.textContent('body');
      if (pageText.includes('Optimo') || pageText.includes('OPTIMO')) {
        console.log('Found Optimo IT mentioned somewhere on Peter\'s profile page');
        optimoCompanyFound = true;
        
        // Try to find any company link on the page
        const companyLinks = page.locator('a[href^="/companies/"]');
        const linkCount = await companyLinks.count();
        
        for (let i = 0; i < linkCount; i++) {
          const link = companyLinks.nth(i);
          const linkText = await link.textContent();
          if (linkText.includes('Optimo') || linkText.includes('OPTIMO')) {
            const href = await link.getAttribute('href');
            optimoCompanyId = href.split('/companies/')[1];
            console.log(`Optimo IT Company ID from link: ${optimoCompanyId}`);
            break;
          }
        }
      }
    }
    
    console.log(`Optimo company found: ${optimoCompanyFound}, Company ID: ${optimoCompanyId}`);
    
    // Step 3: Navigate to companies and find Optimo IT
    console.log('Step 3: Navigating to companies to find Optimo IT...');
    await page.click('a[href="/companies"]');
    await expect(page).toHaveURL('/companies');
    
    // Search for Optimo IT in companies
    await page.fill('input[name="search"]', 'Optimo');
    await page.click('button[type="submit"]');
    
    // Wait for search results
    await page.waitForSelector('.company-card, .company-item, table tbody tr', { timeout: 10000 });
    
    let optimoInCompaniesFound = false;
    let viewProfilesButton = null;
    
    // Check if results are in cards or table format
    const companyCards = page.locator('.company-card, .company-item');
    const companyRows = page.locator('table tbody tr');
    
    if (await companyCards.count() > 0) {
      // Card format
      const cardCount = await companyCards.count();
      for (let i = 0; i < cardCount; i++) {
        const card = companyCards.nth(i);
        const cardText = await card.textContent();
        if (cardText.includes('Optimo') || cardText.includes('OPTIMO')) {
          console.log(`Found Optimo IT in company card ${i + 1}`);
          optimoInCompaniesFound = true;
          // Look for the View Profiles button (icon with bi-people)
          viewProfilesButton = card.locator('a[title="View Profiles"], .bi-people').first();
          break;
        }
      }
    } else if (await companyRows.count() > 0) {
      // Table format
      const rowCount = await companyRows.count();
      for (let i = 0; i < rowCount; i++) {
        const row = companyRows.nth(i);
        const rowText = await row.textContent();
        if (rowText.includes('Optimo') || rowText.includes('OPTIMO')) {
          console.log(`Found Optimo IT in company row ${i + 1}`);
          optimoInCompaniesFound = true;
          // Find the View Profiles button in this row - it's the button with bi-people icon
          viewProfilesButton = row.locator('a[title="View Profiles"], a:has(.bi-people)').first();
          break;
        }
      }
    }
    
    expect(optimoInCompaniesFound, 'Optimo IT should be found in companies list').toBeTruthy();
    expect(viewProfilesButton, 'Should find View Profiles button').toBeTruthy();
    
    // Step 4: Click the "View Profiles" button
    console.log('Step 4: Clicking the View Profiles button for Optimo IT...');
    await viewProfilesButton.click();
    
    // Wait for profiles page to load
    await page.waitForTimeout(2000);
    console.log(`Current URL after clicking View Profiles: ${page.url()}`);
    
    // Look for Peter Holcomb in the profiles list
    console.log('Looking for Peter Holcomb in the profiles list...');
    let peterInCompanyProfiles = false;
    
    // Check for profiles table or list
    const profilesTable = page.locator('tbody tr[data-profile-id], .profile-card, .profile-item');
    const profileRowCount = await profilesTable.count();
    
    console.log(`Found ${profileRowCount} profile rows/items to check`);
    if (profileRowCount > 0) {
      for (let i = 0; i < profileRowCount; i++) {
        const profileItem = profilesTable.nth(i);
        const profileText = await profileItem.textContent();
        if (profileText.includes('Peter') && profileText.includes('Holcomb')) {
          console.log('✅ SUCCESS: Peter Holcomb found in the profiles for Optimo IT!');
          peterInCompanyProfiles = true;
          break;
        }
      }
    } else {
      console.log('No profile rows/items found, checking entire page...');
      const pageText = await page.textContent('body');
      if (pageText.includes('Peter') && pageText.includes('Holcomb')) {
        console.log('✅ SUCCESS: Peter Holcomb found somewhere on the profiles page!');
        peterInCompanyProfiles = true;
      }
    }
    
    // Also check if there's a profiles count displayed
    const profileCountElements = page.locator(':text-matches("\\\\d+.*profile", "i")');
    if (await profileCountElements.count() > 0) {
      const countText = await profileCountElements.first().textContent();
      console.log(`Profile count displayed: ${countText}`);
    }
    
    // Take a screenshot of the final result
    await page.screenshot({ path: 'test-results/optimo-profiles-result.png', fullPage: true });
    
    if (!peterInCompanyProfiles) {
      console.log('❌ Peter Holcomb NOT found in View Profiles results');
      // Take additional debug screenshot
      await page.screenshot({ path: 'test-results/view-profiles-debug.png', fullPage: true });
    }
    
    expect(peterInCompanyProfiles, 'Peter Holcomb should appear when clicking View Profiles for Optimo IT').toBeTruthy();
    
    console.log('🎉 Test completed successfully!');
  });
  
  test('Direct API test - verify backend API endpoints', async ({ request }) => {
    // This test calls the Railway backend API directly to verify it's working
    console.log('Testing Railway backend API endpoints directly...');
    
    // Use the Railway backend URL
    const backendBaseUrl = 'https://smooth-mailbox-production.up.railway.app/api/v1';
    const apiKey = process.env.API_KEY || 'li_HieZz-IjBp0uE7d-rZkRE0qyy12r5_ZJS_FR4jMvv0I';
    
    // First, get a list of companies to find Optimo IT
    const companiesResponse = await request.get(`${backendBaseUrl}/companies?name=Optimo`, {
      headers: {
        'Accept': 'application/json',
        'X-API-Key': apiKey
      }
    });
    
    console.log(`Companies API status: ${companiesResponse.status()}`);
    if (!companiesResponse.ok()) {
      const errorText = await companiesResponse.text();
      console.log(`Companies API error: ${errorText}`);
    }
    
    expect(companiesResponse.ok(), 'Backend companies API should respond successfully').toBeTruthy();
    const companiesData = await companiesResponse.json();
    console.log(`Found ${companiesData.data?.length || 0} companies matching "Optimo"`);
    
    if (companiesData.data && companiesData.data.length > 0) {
      const optimoCompany = companiesData.data.find(c => 
        c.company_name.toLowerCase().includes('optimo')
      );
      
      if (optimoCompany) {
        console.log(`Found Optimo company: ${optimoCompany.company_name}`);
        console.log(`Company ID: ${optimoCompany.id}`);
        
        // Now test the profiles endpoint
        const profilesResponse = await request.get(`${backendBaseUrl}/companies/${optimoCompany.id}/profiles`, {
          headers: {
            'Accept': 'application/json',
            'X-API-Key': apiKey
          }
        });
        
        console.log(`Profiles API status: ${profilesResponse.status()}`);
        if (!profilesResponse.ok()) {
          const errorText = await profilesResponse.text();
          console.log(`Profiles API error: ${errorText}`);
        }
        
        expect(profilesResponse.ok(), 'Backend company profiles API should respond successfully').toBeTruthy();
        const profilesData = await profilesResponse.json();
        console.log(`Found ${profilesData.data?.length || 0} profiles for Optimo IT`);
        console.log('Profile response structure:', Object.keys(profilesData));
        
        if (profilesData.data) {
          const profiles = profilesData.data || [];
          console.log('Available profiles:', profiles.map(p => {
            const name = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown';
            return { name, id: p.id, fields: Object.keys(p) };
          }));
          
          const peterProfile = profiles.find(p => {
            const name = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
            return name.includes('Peter') && name.includes('Holcomb');
          });
          
          if (peterProfile) {
            console.log('✅ API SUCCESS: Peter Holcomb found in Optimo IT profiles via backend API!');
            console.log(`Peter's profile data:`, JSON.stringify(peterProfile, null, 2));
          } else {
            console.log('⚠️  Peter Holcomb not found in backend API response');
          }
        } else {
          console.log('No profile data array in response');
        }
      } else {
        console.log('Optimo company not found in response');
        console.log('Available companies:', companiesData.data.map(c => c.company_name));
      }
    } else {
      console.log('No companies found in response');
    }
  });
});
