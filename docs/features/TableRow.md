### XML Data Example
<Opportunity>
  <Contact_First_Name__c>Jamie</Contact_First_Name__c>
  <Account.Name>Dallas Stars</Account.Name>
  <Account.BillingState/>
  <Basic_Lives__c>0</Basic_Lives__c>
  <Plus_Lives__c>12</Plus_Lives__c>
  <First_Payroll_Processing_Date__c/>
  <Start_Date__c/>
  <Annual_Monthly__c>Monthly</Annual_Monthly__c>
  <Plus_Price__c>$ 99.00</Plus_Price__c>
  <Basic_Price__c>$ 0.00</Basic_Price__c>
  <Case__r.Eligible_Providers__c/>
  <Case__r.Rate_Lock__c/>
  <Discount_1_Detail__c/>
  <Discount_2_Detail__c/>
  <DM__r.Name>Jamie Benn</DM__r.Name>
  <DM__r.FirstName>Jamie</DM__r.FirstName>
  <DM__r.Title/>
  <Total_Price__c>$ 99.00</Total_Price__c>
  <Id>0061k000007snVpAAI</Id>
  <Cases__r_Container>
    <Cases__r>
      <Rate_Lock__c>True</Rate_Lock__c>
      <CaseNumber>00490302</CaseNumber>
      <SuppliedName/>
      <Status>Expired</Status>
      <Eligible_Providers__c>United</Eligible_Providers__c>
      <Subject>HIQ</Subject>
      <Id>5001k00000EL3D5AAL</Id>
    </Cases__r>
    <Cases__r>
      <Rate_Lock__c>False</Rate_Lock__c>
      <CaseNumber>00490303</CaseNumber>
      <SuppliedName/>
      <Status>Proposal Sent Illustrative</Status>
      <Eligible_Providers__c>Kaiser</Eligible_Providers__c>
      <Subject>HIQ</Subject>
      <Id>5001k00000EL3E3AAL</Id>
    </Cases__r>
  </Cases__r_Container>
</Opportunity>

### Example Table Structure

<!-- Main table structure representing a case management system -->
<table class="case-management-table">
    <!-- Table header defining the main data categories -->
    <thead>
        <tr>
            <th scope="col" data-field="product">Product Name</th>
            <th scope="col" data-field="providers">Eligible Providers</th>
            <th scope="col" data-field="rate-lock">Rate Lock</th>
            <th scope="col" data-field="status">Status</th>
        </tr>
    </thead>
    
    <!-- Table body containing template syntax for dynamic data -->
    <tbody>
        <!-- Each row represents a case from the Opportunity object -->
        <tr class="case-row">
            <!-- Product/Case Number field using nested template syntax -->
            <td class="product-column">
                <!-- Outer template selects all cases related to the opportunity -->
                <span class="template-row" data-select="Opportunity//Cases__r">
                    <!-- Inner template retrieves the case number -->
                    <span class="template-content" data-select="./CaseNumber"></span>
                </span>
            </td>
            
            <!-- Eligible Providers field -->
            <td class="providers-column">
                <span class="template-content" data-select="./Eligible_Providers__c"></span>
            </td>
            
            <!-- Rate Lock field -->
            <td class="rate-lock-column">
                <span class="template-content" data-select="./Rate_Lock__c"></span>
            </td>
            
            <!-- Status field -->
            <td class="status-column">
                <span class="template-content" data-select="./Status"></span>
            </td>
        </tr>
    </tbody>
</table>

### Explanation

The feature we want to introduce is a feature of our CLM systems document generation placeholders that can create dynamic tables.

### Task

In the advanced tab of the chrome app we need to let the usdr select a TableRow option, then also let them select the parent node from another dropdown, then from that we loop through the inner nodes and create the placeholders like in the example above.
