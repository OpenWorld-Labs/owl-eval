Yes exactly. Lets first perform a cleanup, refactoring, and      │
│   dead code removal. We have a few features that need to be        │
│   implemented before a REAL evaluation is run. 1) we need to add   │
│   screening questions                                              │
│   2) we need to make sure instructions are clear                   │
│   3) we need to run real evaluation.\                              │
│   In the far future we will be making it into a multi tenant       │
│   system as well for different orgs. But the multi tenant is far   │
│   away. Just when you write new code or clean up existing code     │
│   just ensure to have this multi tenancy in mind.\                 │
│   \                                                                │
│   First is cleanup, and potentially add screening questions to     │
│   our       


curl -H "Authorization: Token cTwGojST_L8H72XJG089jBs50kLn5KWSqkdesISQqbsak3fStUydB3fR_vtR71JmhNZsHTfMI9E6d3-ixPDW_DrG_jZyJyXpGF3YZnzRXSgoQAkdcMvEeoJT" \
       -H "Content-Type: application/json" \
       https://api.prolific.com/api/v1/studies/685b58dafe8c65067db26593/submissions/


curl -H "Authorization: Token cTwGojST_L8H72XJG089jBs50kLn5KWSqkdesISQqbsak3fStUydB3fR_vtR71JmhNZsHTfMI9E6d3-ixPDW_DrG_jZyJyXpGF3YZnzRXSgoQAkdcMvEeoJT" \
       https://api.prolific.com/api/v1/studies/685b58dafe8c65067db26593/export/

curl -H "Authorization: Token cTwGojST_L8H72XJG089jBs50kLn5KWSqkdesISQqbsak3fStUydB3fR_vtR71JmhNZsHTfMI9E6d3-ixPDW_DrG_jZyJyXpGF3YZnzRXSgoQAkdcMvEeoJT" \
       -H "Content-Type: application/json" \
       https://api.prolific.com/api/v1/studies/685b58dafe8c65067db26593/submissions/

# Use database management tools or Prisma Studio for manual queries:
# ./evalctl db:count -t TwoVideoComparisonSubmission  
# npm run db:studio





