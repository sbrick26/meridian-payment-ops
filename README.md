AP PAYMENT OPERATIONS CONSOLE (PAYOPS)
======================================

Application code : PAYOPS
Version          : 2.4.1
Owner            : Accounts Payable, 3rd floor
Maintained by    : IT Dept - Finance Systems Team
Contact          : finance-apps@meridiancorp.example / service desk ext 4471

Meridian Corp internal application. Not for distribution outside the company.


1. WHAT THIS IS
---------------

The console the Accounts Payable desk use to work held vendor payments and
the inquiries that come with them. It replaced the green bar listings and
the Access database in 2013. It reads the nightly ERP payables extract into
a local file and presents it on four screens:

    /                     Dashboard - open inquiries, payable held, average
                          age, flagged count, workload by AP clerk
    /exceptions           Held payments - filter, search, page, open item
    /exceptions/<id>      Item detail - payment, invoice, vendor, notes,
                          release / hold actions
    /reports              Reports R-01 to R-06 and the CSV extract

Three interfaces are served for other systems:

    /api/payment-status?ref=MT-2026-08815      payment enquiry by reference
    /api/payment-status?invoice=INV-2026-4471  payment enquiry by invoice
    /api/risk-score?ref=MT-2026-08815          enquiry desk traffic light
    /api/exceptions.xml                        ERP nightly extract (ERPBATCH01)

Vendors who ring the AP hotline almost never have our payment reference,
they have their own invoice number, so the status enquiry accepts either.
The ERP feed is XML because the batch bridge cannot consume JSON. Do not
change the element names - the record layout on the ERP side is fixed and
a change needs a joint release.


2. WHAT YOU NEED
----------------

    Node runtime on the desktop build (the standard image is fine)
    Roughly 6 MB of disk for the local payables file

Nothing else. There is no application server, no web server in front and
no database server - the payables file is a local SQLite file called
payops.db in the application directory.


3. INSTALLING
-------------

From a command prompt in the application directory:

    npm install

That pulls the three supported libraries listed in package.json. The
intranet stylesheet and the JavaScript library are held in public/vendor
because the desktop build has no outbound internet access - do not
change them to point at an external address.


4. RUNNING IT
-------------

    npm start

The console listens on port 4600:

    http://localhost:4600/

On the first start the application notices payops.db is missing and
loads it from the extract routine automatically (about a second). To
reload the file by hand - for example after somebody has released half
the queue during a walkthrough:

    del payops.db          (Windows)
    rm payops.db           (everything else)
    npm start

or run the loader directly:

    npm run seed

The extract is generated from a fixed sequence, so the figures come back
identical every time it is loaded. The dashboard tiles are calculated
from the file, not typed in, so they always agree with the queue and the
reports. As at 2026-08-01 the position is:

    Open inquiries / held payments   247
    Payable held                     $2.31M
    Average age                      4.2 days
    Flagged                          12

There are also 150 closed items retained for the reports.


5. CONFIGURATION
----------------

There is no properties file. Everything is at the top of server.js:

    PORT                   4600
    PAGE_SIZE              25 rows per page on the queue
    AS_OF_DATE             position date shown in the header
    APPROVAL_LIMIT_CENTS   second sign-off threshold (procedure AP-114)
    SMTP_*                 relay used by the overnight vendor chaser job
    ERP_FEED_*             details for the ERPBATCH01 feed

Change the value, save the file and restart the process. There is no
hot reload.


6. FILES
--------

    server.js               all screens and interfaces
    utils.js                formatting, escaping, HTML helpers, risk bands
    seed.js                 loads payops.db from the ERP payables extract
    views/                  screen templates
    views/partials/         masthead, navigation, footer
    public/payops.css       local styling
    public/payops.js        screen behaviour (row select, confirms, clock)
    public/vendor/          intranet stylesheet and JavaScript library
    payops.db               local payables file (not in source control)


7. SUPPORT NOTES
----------------

Known issues, also listed on the Help screen:

    INC-0042   Vendor inquiry call volume. The AP hotline receives around
               340 vendor payment status calls a week and there is no self
               service for vendors - every call is worked by hand from the
               held payments screen. Raised with Finance Systems, open.
    INC-44192  Age is counted in calendar days, not business days. The
               calendar table was never delivered by reference data.
    INC-45077  Clerk column blank for items keyed by the batch user.
    INC-45310  Printing the queue prints the current page only.
               The desk work around it by exporting to CSV.

If the ERP poll fails, the overnight payables reconciliation will break.
Call the service desk on ext 4471 and ask for the finance applications
on call before the 06:00 window.

Do not email CSV extracts outside the company (policy IS-004).
