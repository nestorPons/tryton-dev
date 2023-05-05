# tryton-dev
Template default job Tryton project

`python -m venv venv`

`source venv/bin/activate`

`pip install --upgrade pip`

`pip install -r requirements.txt`

`docker-compose up -d`

`cd sao`

`npm install --legacy-peer-deps`

`grunt dev`

`source .env.local`

`restart`

```
"admin" email for "trytondb": admin
"admin" password for "trytondb": admin
"admin" password confirmation: admin
```

`trytond_import_currencies -c trytond.conf -d trytondb`

`trytond_import_countries -c trytond.conf -d trytondb`

`trytond_import_postal_codes -c trytond.conf -d trytondb es`

`trytond`



