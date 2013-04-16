describe("Task Day Model Tests", function(){
    beforeEach(function() {
        //
    });

    it("should return default values", function(){
        var today = new Date();
        var today_iso_string = Rally.util.DateTime.toIsoString(today,false).replace(/T.*$/,"");
        var model = Ext.create('Rally.pxs.data.TaskDay',{});
        expect(model.get('IsoDate')).toMatch(new RegExp(today_iso_string)); // off by second 
        expect(model.get('ShortIsoDate')).toEqual(today_iso_string);
        expect(model.get('TaskRemainingTotal')).toEqual(0);
        expect(model.get('IdealTaskRemainingTotal')).toEqual(0);
    });
    
    it("should return an iso date string when given an iso date string", function(){
        var model = Ext.create('Rally.pxs.data.TaskDay',{ 'IsoDate': '2012-12-01' });
        expect(model.get('IsoDate')).toEqual("2012-12-01");
        expect(model.get('ShortIsoDate')).toEqual("2012-12-01");
    });
    
    it("should return an iso date string when given an iso date and time string", function(){
        var model = Ext.create('Rally.pxs.data.TaskDay',{ 'IsoDate': '2012-12-01T01:13' });
        expect(model.get('IsoDate')).toEqual("2012-12-01T01:13");
        expect(model.get('ShortIsoDate')).toEqual("2012-12-01");
    });
    
    it("should return an iso date string when given a javascript date", function(){
        var model = Ext.create('Rally.pxs.data.TaskDay',{ 'IsoDate': new Date('2012-12-01T23:55-0700') });
        expect(model.get('IsoDate')).toEqual("2012-12-01T22:55:00-08:00");
        expect(model.get('ShortIsoDate')).toEqual("2012-12-01");
    });
    
    it("should add to the taskremainingtotal", function(){
        var model = Ext.create('Rally.pxs.data.TaskDay',{ 'TaskRemainingTotal': 5 });
        model.addTo("TaskRemainingTotal",7);
        expect(model.get('TaskRemainingTotal')).toEqual(12);
    });
    
    it("should calculate a difference from ideal when ideal is above actual total", function() {
        var model = Ext.create('Rally.pxs.data.TaskDay', { 'TaskRemainingTotal': 5, 'IdealTaskRemainingTotal': 8 });
        expect(model.get('IdealTaskRemainingDelta')).toEqual(-3);
    });
    
    it("should calculate a difference from ideal when ideal is below actual total", function() {
        var model = Ext.create('Rally.pxs.data.TaskDay', { 'TaskRemainingTotal': 5, 'IdealTaskRemainingTotal': 3 });
        expect(model.get('IdealTaskRemainingDelta')).toEqual(2);
    });
    
    it("should calculate a difference from ideal when ideal is provided after creation", function() {
        var model = Ext.create('Rally.pxs.data.TaskDay', { 'TaskRemainingTotal': 5 });
        model.addTo('IdealTaskRemainingTotal', 3);
        expect(model.get('IdealTaskRemainingDelta')).toEqual(2);
    });

    it("should make nulls for some of the data when item is in Future", function(){
        var model = Ext.create('Rally.pxs.data.TaskDay', { 
            'IdealTaskRemainingDelta': -5, 
            'IdealTaskRemainingTotal': 10,
            'TaskRemainingTotal': 5 
        });

        model.set('Future',true);
        expect(model.get('IdealTaskRemainingDelta')).toEqual(null);
        expect(model.get('TaskRemainingTotal')).toEqual(null);
        expect(model.get('IdealTaskRemainingTotal')).toEqual(10);
    });
    
    it("should make nulls for when item is in Future and fields change", function(){
        var model = Ext.create('Rally.pxs.data.TaskDay', { 
            'IdealTaskRemainingDelta': -5, 
            'IdealTaskRemainingTotal': 10,
            'TaskRemainingTotal': 5 
        });

        model.set('Future',true);
        model.set('TaskRemainingTotal',12);
        expect(model.get('IdealTaskRemainingDelta')).toEqual(null);
        expect(model.get('TaskRemainingTotal')).toEqual(null);
        expect(model.get('IdealTaskRemainingTotal')).toEqual(10);
    });
    
    it("should limit decimal places displayed", function(){
        var model = Ext.create('Rally.pxs.data.TaskDay', { 
            'IdealTaskRemainingDelta': -4.666666666, 
            'IdealTaskRemainingTotal': 5.333333333333333,
            'TaskRemainingTotal': 10
        });

        expect(model.get('IdealTaskRemainingDelta')).toEqual(4.7);
        expect(model.get('TaskRemainingTotal')).toEqual(10);
        expect(model.get('IdealTaskRemainingTotal')).toEqual(5.3);
    });});