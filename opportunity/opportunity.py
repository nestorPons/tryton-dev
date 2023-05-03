from trytond.model import ModelSQL, ModelView, fields, Workflow
from trytond.pool import Pool
import datetime as dt
from trytond.pyson import If, Bool, Eval


class Opportunity(Workflow, ModelSQL, ModelView):
    "Opportunity"
    __name__ = 'training.opportunity'
    _rec_name = 'description'

    description = fields.Char("Description", required=True)
    start_date = fields.Date(
        "Start Date", required=True,
        domain=[
            If(Bool(Eval('end_date')),
                ('start_date', '<=', Eval('end_date')),
                ())])
    end_date = fields.Date(
        "End Date",
        domain=[
            If(Bool(Eval('end_date')),
                ('end_date', '>=', Eval('start_date')),
                ())])
    party = fields.Many2One('party.party', "Party", required=True)
    comment = fields.Text("Comment")
    duration = fields.Function(fields.TimeDelta(
        "Duration"), 'on_change_with_duration')
    address = fields.Many2One('party.address', "Address",
                              domain=[
                                  ('party', '=', Eval('party', -1)),
                              ])
    state = fields.Selection([
        ('draft', "Draft"),
        ('converted', "Converted"),
        ('lost', "Lost"),
    ], "State",
        required=True, readonly=True, sort=False)

    @classmethod
    def __setup__(cls):
        super().__setup__()
        cls._transitions.update({
            ('draft', 'converted'),
            ('draft', 'lost'),
        })
        cls._buttons.update({
            'convert': {},
            'lost': {},
        })

    @classmethod
    def default_state(cls):
        return 'draft'

    @classmethod
    @ModelView.button
    @Workflow.transition('converted')
    def convert(cls, opportunities):
        pool = Pool()
        Date = pool.get('ir.date')
        cls.write(opportunities, {
            'end_date': Date.today(),
        })

    @classmethod
    @ModelView.button
    @Workflow.transition('lost')
    def lost(cls, opportunities):
        pool = Pool()
        Date = pool.get('ir.date')
        cls.write(opportunities, {
            'duration': 0,
        })

    @classmethod
    def default_start_date(cls):
        pool = Pool()
        Date = pool.get('ir.date')
        return Date.today()

    @fields.depends('start_date')
    def on_change_with_end_date(self):
        if self.start_date:
            return self.start_date + dt.timedelta(days=3)

    @fields.depends('party', 'description', 'comment')
    def on_change_party(self):
        if self.party:
            if not self.description:
                self.description = self.party.rec_name
            if not self.comment:
                lines = []
                if self.party.phone:
                    lines.append("Tel: %s" % self.party.phone)
                if self.party.email:
                    lines.append("Mail: %s" % self.party.email)
                self.comment = '\n'.join(lines)

    @fields.depends('start_date', 'end_date')
    def on_change_with_duration(self, name=None):
        if self.start_date and self.end_date:
            return self.end_date - self.start_date
        return None
